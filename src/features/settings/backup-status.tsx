"use client";
import { useEffect, useState } from "react";
import {
  backupStatusSchema,
  backupWarning,
  type BackupStatus as Status,
} from "@/lib/backups";
import { formatDateTime } from "@/lib/journal/view-config";
export function BackupStatus({ details = false }: { details?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState({ now: Date.now(), offset: 0 });
  useEffect(() => {
    let active = true;
    let inFlight: AbortController | null = null;
    async function update() {
      if (inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("/api/backups", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Backup status unavailable");
        const value = backupStatusSchema.parse(await response.json());
        if (
          !value ||
          !("lastSuccess" in value) ||
          !Number.isFinite(Date.parse(value.checkedAt))
        )
          throw Error("Invalid backup status");
        if (active) {
          setStatus(value);
          setFailed(false);
          setClock({
            now: Date.now(),
            offset: Date.parse(value.checkedAt) - Date.now(),
          });
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        window.clearTimeout(timeout);
        inFlight = null;
        if (active) setChecked(true);
      }
    }
    void update();
    const poll = window.setInterval(update, 5 * 60_000);
    const tick = window.setInterval(
      () => setClock((c) => ({ ...c, now: Date.now() })),
      60_000,
    );
    window.addEventListener("focus", update);
    return () => {
      active = false;
      inFlight?.abort();
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.removeEventListener("focus", update);
    };
  }, []);
  const warning = checked
    ? backupWarning(failed ? null : status, clock.now + clock.offset)
    : "";
  const last = status?.lastSuccess;
  return (
    <>
      {warning && (
        <div className="banner backup-warning" role="alert">
          <span>
            {warning}
            {last?.completed_at && (
              <> Último correcto: {formatDateTime(last.completed_at)}.</>
            )}
          </span>
          <a className="secondary" href="/api/export">
            Descargar datos
          </a>
        </div>
      )}
      {details && (
        <article className="panel backup-details">
          <h2>Respaldos automáticos</h2>
          <p>Todos los días a las 03:00 (Argentina). Se conservan 30 copias.</p>
          <p>
            {!checked
              ? "Consultando…"
              : last?.completed_at
                ? "Último correcto: " + formatDateTime(last.completed_at)
                : "Sin copia disponible."}
          </p>
          {last && (
            <a className="secondary" href="/api/backups?download=latest">
              Descargar última copia
            </a>
          )}
          <p className="fine-print">
            Las copias se guardan en esta base de datos. Guardá también una
            fuera de Supabase.
          </p>
        </article>
      )}
    </>
  );
}
