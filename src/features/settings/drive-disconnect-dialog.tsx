import { Modal } from "@/components/ui/dialog";

export function DriveDisconnectDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      title="Desconectar Google Drive"
      onClose={() => !busy && onCancel()}
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
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button className="danger" disabled={busy} onClick={onConfirm}>
            Confirmar desconexión
          </button>
        </div>
      </div>
    </Modal>
  );
}
