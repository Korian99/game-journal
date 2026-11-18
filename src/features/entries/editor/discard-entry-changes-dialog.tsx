import { Modal } from "@/components/ui/dialog";

type DiscardEntryChangesDialogProps = {
  onKeepEditing: () => void;
  onDiscard: () => void;
};

function DiscardEntryChangesDialogContent({
  onKeepEditing,
  onDiscard,
}: DiscardEntryChangesDialogProps) {
  return (
    <div className="modal-body">
      <p>Tenés cambios sin guardar.</p>
      <div className="button-row">
        <button className="secondary" autoFocus onClick={onKeepEditing}>
          Seguir editando
        </button>
        <button className="danger" onClick={onDiscard}>
          Descartar cambios
        </button>
      </div>
    </div>
  );
}

export function renderDiscardEntryChangesDialog(
  props: DiscardEntryChangesDialogProps,
) {
  return (
    <Modal open title="Descartar cambios" onClose={props.onKeepEditing}>
      <DiscardEntryChangesDialogContent {...props} />
    </Modal>
  );
}
