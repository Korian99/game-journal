"use client";
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
  if (!edit.active && !edit.message && !edit.error && !edit.history.length)
    return null;
  return (
    <aside className="inline-edit-bar" aria-label="Edición directa">
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
          <button
            className="secondary"
            title="Ctrl+Z"
            disabled={edit.saving || !edit.canEdit || !edit.history.length}
            onClick={() => void edit.undo()}
          >
            <Undo2 size={15} />
            Deshacer
          </button>
        )}
      </span>
    </aside>
  );
}
