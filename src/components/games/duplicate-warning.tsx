"use client";
import { EntrySaveStatus } from "./entry-save-status";
import { statuses } from "@/lib/types";
import { Modal } from "../ui/dialog";
import type { JournalEntry } from "@/lib/journal/journal-types";
export function DuplicateWarning({
  matches,
  busy,
  onClose,
  onOpen,
  onReplay,
  onConfirm,
  editing = false,
}: {
  matches: JournalEntry[];
  editing?: boolean;
  busy: boolean;
  onClose: () => void;
  onOpen: (record: JournalEntry) => void;
  onReplay: (record: JournalEntry) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      title={editing ? "Coincidencia con otro juego" : "¿Ya tenés este juego?"}
      onClose={() => !busy && onClose()}
      headerStatus={busy ? <EntrySaveStatus /> : undefined}
    >
      <div className="modal-body">
        <p>
          {editing
            ? "El nombre o la página coincide con otra entrada. Guardar actualiza la partida que estabas editando y mantiene ambas entradas."
            : "Coincide el nombre o una página de tienda. Elegí cómo continuar; no se combinarán entradas automáticamente."}
        </p>
        {matches.map((record) => (
          <article className="duplicate-match" key={record.id}>
            <strong>{record.title}</strong>
            <small>
              {statuses[record.status]} ·{" "}
              {record.device || record.platforms || "Sin plataforma"}
            </small>
            {!editing && (
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onOpen(record)}
                >
                  Descartar borrador y abrir existente
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onReplay(record)}
                >
                  Crear otra partida de este juego
                </button>
              </div>
            )}
          </article>
        ))}
        <div className="button-row">
          <button
            autoFocus
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {editing ? "Volver a la edición" : "Volver al formulario"}
          </button>
          <button className="primary" disabled={busy} onClick={onConfirm}>
            {busy
              ? "Guardando…"
              : editing
                ? "Guardar cambios en esta partida"
                : "Guardar como juego separado"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
