import type { ComponentProps } from "react";
import { NotebookGameReminderPicker } from "./notebook-game-reminder-picker";

export const notebookFormMessages = {
  saved: "Guardado",
  loadError: "No se pudo cargar el cuaderno. Volvé a intentarlo.",
  saveError: "No se pudo guardar el cuaderno. Volvé a intentarlo.",
};

export function NotebookForm({
  content,
  disabled,
  saving,
  loadError,
  error,
  saved,
  reminder,
  onContentChange,
  onRetry,
  onSave,
}: {
  content: string;
  disabled: boolean;
  saving: boolean;
  loadError: boolean;
  error: string;
  saved: string;
  reminder: Omit<ComponentProps<typeof NotebookGameReminderPicker>, "disabled">;
  onContentChange: (value: string) => void;
  onRetry: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-body notebook-modal-body">
      <label className="notebook-notes-label" htmlFor="notebook-notes">
        Notas
      </label>
      <textarea
        id="notebook-notes"
        aria-label="Notas"
        maxLength={100000}
        value={content}
        disabled={disabled}
        onChange={(event) => onContentChange(event.target.value)}
      />
      <NotebookGameReminderPicker {...reminder} disabled={disabled} />
      {error && (
        <p className="notebook-message" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="notebook-message notebook-saved" role="status">
          {saved}
        </p>
      )}
      {loadError && (
        <button className="secondary" onClick={onRetry}>
          Reintentar carga
        </button>
      )}
      <div className="notebook-save-row">
        <button className="primary" disabled={disabled} onClick={onSave}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
