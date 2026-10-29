"use client";
import { useEffect, useState } from "react";
import type { InlineEditing } from "@/hooks/use-inline-editing";
import { inlineFields } from "@/lib/journal/inline-editing";
import { Check, LoaderCircle, Undo2, X } from "lucide-react";
export function InlineEditBar({
  edit,
  onReturn,
}: {
  edit: InlineEditing;
  onReturn: () => void;
}) {
  const idleConfirmation =
    !edit.active && !edit.saving && !edit.error && Boolean(edit.message);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    if (!idleConfirmation) return;
    const timeout = window.setTimeout(() => setDismissed(true), 2500);
    return () => window.clearTimeout(timeout);
  }, [edit.active?.field, edit.error, edit.message, edit.saving]);

  if (
    (!edit.active && !edit.message && !edit.error) ||
    (idleConfirmation && dismissed)
  )
    return null;

  return (
    <aside
      className={`inline-edit-bar${idleConfirmation ? " is-confirmation" : ""}`}
      aria-label="Edición directa"
    >
      {edit.error && (
        <span className="error" role="alert">
          {edit.error}
        </span>
      )}
      {edit.saving ? (
        <span className="inline-save-status" role="status">
          <LoaderCircle size={15} className="save-spinner" />
          Guardando…
        </span>
      ) : edit.active ? (
        <span>
          Editando <b>{inlineFields[edit.active.field].label}</b> ·{" "}
          {edit.active.entry.title}
        </span>
      ) : (
        <span role="status">
          <Check size={14} /> {edit.message}
        </span>
      )}
      <span className="inline-bar-actions">
        {edit.active ? (
          <>
            <button
              className="text-button"
              disabled={edit.saving}
              onClick={onReturn}
            >
              Volver a la celda
            </button>
            <button
              className="text-button"
              disabled={edit.saving}
              onClick={() => void edit.save()}
            >
              Guardar edición
            </button>
            <button
              className="icon-button"
              disabled={edit.saving}
              aria-label="Cancelar edición"
              onClick={edit.cancel}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            {edit.history.length > 0 && (
              <button
                className="secondary"
                title="Ctrl+Z"
                disabled={edit.saving || !edit.canEdit}
                onClick={() => void edit.undo()}
              >
                <Undo2 size={15} />
                Deshacer
              </button>
            )}
            {idleConfirmation && (
              <button
                className="icon-button"
                aria-label="Cerrar confirmación"
                title="Cerrar confirmación"
                onClick={() => setDismissed(true)}
              >
                <X size={15} />
              </button>
            )}
          </>
        )}
      </span>
    </aside>
  );
}
