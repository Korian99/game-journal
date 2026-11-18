import { Modal } from "@/components/ui/dialog";

export function TrashPurgeDialog({
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      title="Eliminar definitivamente"
      onClose={() => !busy && onCancel()}
    >
      <div className="modal-body">
        <p>
          Se eliminarán definitivamente {count}{" "}
          {count === 1 ? "entrada" : "entradas"}. Esta acción no se puede
          deshacer.
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
            Confirmar eliminación definitiva
          </button>
        </div>
      </div>
    </Modal>
  );
}
