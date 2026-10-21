"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { journalEntrySchema } from "@/lib/contracts";
import { formatDateTime } from "@/lib/journal/view-config";
import { Modal } from "../ui/dialog";
const trashSchema = z.array(
  journalEntrySchema.and(
    z.object({
      id: z.string(),
      deleted_at: z.string(),
      updated_at: z.string(),
    }),
  ),
);
type Trashed = z.infer<typeof trashSchema>[number];
export function TrashPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<Trashed[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Trashed[] | null>(null);
  async function reload() {
    try {
      setItems(await apiRequest("/api/trash", "GET", undefined, trashSchema));
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  async function restore(item: Trashed) {
    setBusy(true);
    try {
      await apiRequest("/api/trash", "PATCH", {
        id: item.id,
        expected: item.updated_at,
      });
      await reload();
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function purge() {
    if (!selected) return;
    setBusy(true);
    try {
      await apiRequest("/api/trash", "DELETE", {
        items: selected.map((item) => ({
          id: item.id,
          expected: item.updated_at,
        })),
        confirmed: true,
      });
      setSelected(null);
      await reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel">
      <div className="notification-heading">
        <h2>Papelera</h2>
        {items.length > 0 && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => setSelected(items)}
          >
            Vaciar papelera
          </button>
        )}
      </div>
      <p className="fine-print">
        Podés restaurar las entradas durante 30 días. Los permisos de compartir
        no se restauran.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
          <button className="text-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </p>
      )}
      {loading ? (
        <p>Consultando…</p>
      ) : items.length ? (
        items.map((item) => (
          <div className="trash-item" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.device || "Sin consola"} · Eliminada:{" "}
                {formatDateTime(item.deleted_at)}
              </small>
            </div>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void restore(item)}
              >
                Restaurar
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={() => setSelected([item])}
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        ))
      ) : (
        !error && <p className="muted">La papelera está vacía.</p>
      )}
      {selected && (
        <Modal
          open
          title="Eliminar definitivamente"
          onClose={() => !busy && setSelected(null)}
        >
          <div className="modal-body">
            <p>
              Se eliminarán definitivamente {selected.length}{" "}
              {selected.length === 1 ? "entrada" : "entradas"}. Esta acción no
              se puede deshacer.
            </p>
            <div className="button-row">
              <button
                autoFocus
                className="secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void purge()}
              >
                Confirmar eliminación definitiva
              </button>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
