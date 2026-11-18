import type { ReactNode } from "react";
import { Modal } from "@/components/ui/dialog";
import { EntryActionsMenu } from "../entry-actions-menu";
import { EntrySaveStatus } from "../entry-save-status";

export function renderEntryEditorDialog({
  editing,
  saving,
  optionsId,
  deleteDisabled,
  onClose,
  onDeleteRequest,
  children,
}: {
  editing: boolean;
  saving: boolean;
  optionsId: string;
  deleteDisabled: boolean;
  onClose: () => void;
  onDeleteRequest: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Tu partida" : "Agregar un juego"}
      headerStatus={saving ? <EntrySaveStatus /> : undefined}
      onEscapeKeyDown={(event) => {
        const trigger = document.getElementById(optionsId);
        const menu = trigger?.closest("details");
        if (menu?.open) {
          event.preventDefault();
          menu.open = false;
          trigger?.focus();
        }
      }}
      headerActions={
        editing ? (
          <EntryActionsMenu
            triggerId={optionsId}
            busy={deleteDisabled}
            onDeleteRequest={onDeleteRequest}
          />
        ) : undefined
      }
    >
      {children}
    </Modal>
  );
}
