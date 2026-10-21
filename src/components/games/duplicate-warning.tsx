"use client";
import { Modal } from "../ui/dialog";
import type { JournalEntry } from "@/lib/journal/journal-types";
export function DuplicateWarning({
  matches,
  busy,
  onClose,
  onOpen,
  onReplay,
  onSeparate,
}: {
  matches: JournalEntry[];
  busy: boolean;
  onClose: () => void;
  onOpen: (record: JournalEntry) => void;
  onReplay: (record: JournalEntry) => void;
  onSeparate: () => void;
}) {
  return (
    <Modal
      open
      title="¿Ya tenés este juego?"
      onClose={() => !busy && onClose()}
    >
      <div className="modal-body">
        <p>
          Coincide el nombre o una página de tienda. Elegí cómo continuar; no se
          combinarán entradas automáticamente.
        </p>
        {matches.map((record) => (
          <article className="duplicate-match" key={record.id}>
            <strong>{record.title}</strong>
            <small>
              {record.device || record.platforms || "Sin plataforma"}
            </small>
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
          </article>
        ))}
        <div className="button-row">
          <button
            autoFocus
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Volver al formulario
          </button>
          <button className="primary" disabled={busy} onClick={onSeparate}>
            Guardar como juego separado
          </button>
        </div>
      </div>
    </Modal>
  );
}
