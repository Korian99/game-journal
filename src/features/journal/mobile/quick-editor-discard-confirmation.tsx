import type { RefObject } from "react";

export function QuickEditorDiscardConfirmation({
  keepEditingRef,
  onKeepEditing,
  onDiscard,
}: {
  keepEditingRef: RefObject<HTMLButtonElement | null>;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="quick-discard">
      <h3>Descartar cambios</h3>
      <p>Tus cambios todavía no se guardaron.</p>
      <div className="button-row">
        <button
          className="secondary"
          ref={keepEditingRef}
          onClick={onKeepEditing}
        >
          Seguir editando
        </button>
        <button className="text-button danger" onClick={onDiscard}>
          Descartar
        </button>
      </div>
    </section>
  );
}
