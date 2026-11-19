import { Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { Modal } from "@/components/ui/dialog";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { statuses } from "@/lib/types";

export const deleteEntryErrorMessage =
  "No se pudo eliminar la entrada. Podés volver a intentarlo.";

type DeleteEntryDialogProps = {
  entry: Pick<JournalEntry, "title" | "status" | "device" | "started">;
  dirty: boolean;
  busy: boolean;
  error: string;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteEntryDialogContent({
  entry,
  dirty,
  busy,
  error,
  cancelButtonRef,
  onCancel,
  onConfirm,
}: DeleteEntryDialogProps) {
  return (
    <div className="modal-body delete-entry-confirmation">
      <p>
        ¿Querés eliminar esta entrada de <strong>{entry.title}</strong>?
      </p>
      <p className="muted delete-entry-context">
        {[
          statuses[entry.status],
          entry.device,
          entry.started ? "Empecé: " + formatDate(entry.started) : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="fine-print">
        Las demás partidas de este juego se conservan. Podés restaurarla desde
        Papelera durante 30 días.
      </p>
      {dirty && (
        <p className="error">
          Los cambios sin guardar de este formulario se descartarán al eliminar
          la entrada.
        </p>
      )}
      {error && (
        <p className="delete-entry-error" role="alert">
          {error}
        </p>
      )}
      <div className="delete-entry-buttons">
        <button
          ref={cancelButtonRef}
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Volver al editor
        </button>
        <button
          type="button"
          className="danger delete-entry-confirm"
          disabled={busy}
          onClick={onConfirm}
        >
          <Trash2 size={16} />
          {busy ? "Eliminando…" : "Confirmar eliminación"}
        </button>
      </div>
    </div>
  );
}

export function renderDeleteEntryDialog(props: DeleteEntryDialogProps) {
  return (
    <Modal
      open
      title="Eliminar entrada"
      onClose={() => {
        if (!props.busy) props.onCancel();
      }}
    >
      <DeleteEntryDialogContent {...props} />
    </Modal>
  );
}
