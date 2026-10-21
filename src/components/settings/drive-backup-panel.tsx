"use client";
import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import {
  driveStatusSchema,
  externalBackupWarning,
  type DriveBackupStatus,
} from "@/lib/backups/status";
import { formatDateTime } from "@/lib/journal/view-config";
import { createResource } from "@/lib/resource";
import { Modal } from "../ui/dialog";
export function DriveBackupPanel({
  details = true,
}: { details?: boolean } = {}) {
  const resource = useMemo(
    () =>
      createResource<DriveBackupStatus | null>(null, () =>
        apiRequest("/api/backups/drive", "GET", undefined, driveStatusSchema),
      ),
    [],
  );
  const state = useSyncExternalStore(
      resource.subscribe,
      resource.getSnapshot,
      resource.getSnapshot,
    ),
    status = state.data;
  const [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDisconnect, setConfirmDisconnect] = useState(false),
    error = actionError || state.error;
  const reload = resource.load;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("backup") === "error")
      setError(
        "No se pudo conectar Google Drive. Volvé a autorizar con la misma cuenta y comprobá que la carpeta siga siendo privada.",
      );
  }, []);
  useEffect(() => {
    void resource.load();
    const update = () => {
      if (navigator.onLine) void resource.load();
    };
    const timer = setInterval(update, 5 * 60000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
  }, [resource]);
  async function connect() {
    setBusy(true);
    try {
      const result = await apiRequest(
        "/api/backups/drive",
        "POST",
        { action: "connect" },
        z.object({ url: z.string().url() }),
      );
      window.location.assign(result.url);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      await apiRequest(
        "/api/backups/drive",
        "POST",
        { action: "retry" },
        undefined,
        AbortSignal.timeout(60000),
      );
      await reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await apiRequest("/api/backups/drive", "DELETE");
      setConfirmDisconnect(false);
      await reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const warning = status ? externalBackupWarning(status) : "";
  if (!details)
    return warning || error ? (
      <div className="banner backup-warning" role="alert">
        <span>
          {error
            ? "No se pudo verificar la copia externa en Google Drive."
            : warning}
        </span>
        <a className="secondary" href="/?tab=settings">
          Ver copias externas
        </a>
      </div>
    ) : null;
  return (
    <article className="panel">
      <h2>Copia en Google Drive</h2>
      <p className="fine-print">
        JSON y Excel en una carpeta privada. La planilla original no se
        modifica.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
          <button className="text-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </p>
      )}
      {!status && !error ? (
        <p>Consultando…</p>
      ) : status?.configured === false ? (
        <p className="muted">
          Las copias externas todavía no están habilitadas.
        </p>
      ) : status?.connected ? (
        <>
          <p>
            {status.lastSuccess?.verified_at
              ? "Última copia verificada: " +
                formatDateTime(status.lastSuccess.verified_at)
              : "La primera copia está pendiente."}
          </p>
          {warning && (
            <p className="error" role="alert">
              {warning}
            </p>
          )}
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void retry()}
            >
              {busy ? "Procesando…" : "Reintentar copia"}
            </button>
            {status.folderId && (
              <a
                className="secondary"
                href={
                  "https://drive.google.com/drive/folders/" +
                  encodeURIComponent(status.folderId)
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir carpeta
              </a>
            )}
            {status.lastSuccess && (
              <>
                <a
                  className="secondary"
                  href="/api/backups/drive?download=json"
                >
                  Descargar JSON
                </a>
                <a
                  className="secondary"
                  href="/api/backups/drive?download=excel"
                >
                  Descargar Excel
                </a>
              </>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void connect()}
            >
              Reconectar
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => setConfirmDisconnect(true)}
            >
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void connect()}
        >
          Conectar Google Drive
        </button>
      )}
      {status?.connected && (
        <p className="fine-print">
          Se conservan 30 copias diarias y 12 mensuales.
        </p>
      )}
      {confirmDisconnect && (
        <Modal
          open
          title="Desconectar Google Drive"
          onClose={() => !busy && setConfirmDisconnect(false)}
        >
          <div className="modal-body">
            <p>
              Se detendrán las copias automáticas. Los archivos que ya están en
              Drive se conservan.
            </p>
            <div className="button-row">
              <button
                autoFocus
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmDisconnect(false)}
              >
                Cancelar
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                Confirmar desconexión
              </button>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
