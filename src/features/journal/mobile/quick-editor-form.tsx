import { LoaderCircle } from "lucide-react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { QuickFields } from "@/lib/journal/quick-editing";
import { statuses } from "@/lib/types";

export const quickEditorFormMessages = {
  saveError: "No se pudo guardar.",
  validationError: "Revisá los valores.",
};

export function QuickEditorForm({
  entryStatus,
  fields,
  played,
  canStart,
  online,
  saving,
  dirty,
  transitioningTo,
  error,
  onFieldChange,
  onStatusTransition,
  onSave,
  onFull,
  onCancel,
}: {
  entryStatus: JournalEntry["status"];
  fields: QuickFields;
  played: boolean;
  canStart: boolean;
  online: boolean;
  saving: boolean;
  dirty: boolean;
  transitioningTo: "playing" | "completed" | "";
  error: string;
  onFieldChange: (key: keyof QuickFields, value: string) => void;
  onStatusTransition: (status: "playing" | "completed") => void;
  onSave: () => void;
  onFull: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <fieldset disabled={saving || !online || !!transitioningTo}>
        <div className="quick-editor-numbers quick-editor-status-row">
          <label>
            Estado
            <select
              aria-label="Estado"
              value={fields.status}
              onChange={(event) => onFieldChange("status", event.target.value)}
            >
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div>
            {canStart && (
              <button
                type="button"
                className="secondary"
                disabled={saving || !online || !!transitioningTo}
                aria-busy={transitioningTo === "playing"}
                onClick={() => onStatusTransition("playing")}
              >
                {transitioningTo === "playing" && (
                  <LoaderCircle size={15} className="save-spinner" />
                )}
                {transitioningTo === "playing"
                  ? entryStatus === "paused"
                    ? "Retomando…"
                    : "Empezando…"
                  : entryStatus === "paused"
                    ? "Retomar"
                    : "Empezar"}
              </button>
            )}
            {entryStatus === "playing" && (
              <button
                type="button"
                className="secondary"
                disabled={saving || !online || !!transitioningTo}
                aria-busy={transitioningTo === "completed"}
                onClick={() => onStatusTransition("completed")}
              >
                {transitioningTo === "completed" && (
                  <LoaderCircle size={15} className="save-spinner" />
                )}
                {transitioningTo === "completed" ? "Terminando…" : "Terminar"}
              </button>
            )}
          </div>
        </div>
        {played ? (
          <div className="quick-editor-numbers">
            <label>
              Hs. jugadas
              <input
                type="number"
                min={0}
                step="any"
                value={fields.hours}
                onChange={(event) => onFieldChange("hours", event.target.value)}
              />
            </label>
            <label>
              Reseña / 100
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={fields.rating}
                onChange={(event) =>
                  onFieldChange("rating", event.target.value)
                }
              />
            </label>
          </div>
        ) : (
          <label>
            Prioridad
            <input
              type="text"
              value={fields.priority}
              maxLength={100}
              onChange={(event) =>
                onFieldChange("priority", event.target.value)
              }
            />
          </label>
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="quick-editor-actions">
        <button
          type="button"
          className="text-button"
          disabled={saving || !!transitioningTo}
          onClick={onFull}
        >
          Abrir formulario completo
        </button>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={saving || !!transitioningTo}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={saving || !!transitioningTo || !online || !dirty}
          >
            {saving ? (
              <>
                <LoaderCircle size={15} className="save-spinner" />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
