import type { ComponentProps } from "react";
import { Modal } from "@/components/ui/dialog";
import { EntryStart } from "./entry-start";

export function renderEntryStartDialog({
  entryTitle,
  onClose,
  ...start
}: ComponentProps<typeof EntryStart> & {
  entryTitle: string;
  onClose: () => void;
}) {
  const title =
    start.step === "choose"
      ? "¿Cómo querés cargar el juego?"
      : start.step === "search"
        ? "Completar desde el buscador"
        : start.editing
          ? "Actualizar datos de " + entryTitle
          : "Completar desde una página";

  return (
    <Modal open onClose={onClose} title={title}>
      <EntryStart {...start} />
    </Modal>
  );
}
