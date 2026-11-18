import type { ScoringEntry } from "./scoring-guide";

export const scoringGuideFormMessages = {
  discard: "¿Descartar los cambios de la guía?",
  reset:
    "¿Reemplazar el borrador por la guía inicial? Podés revisarlo antes de guardar.",
  saveError: "No se pudo guardar la guía.",
};

export function ScoringGuideForm({
  draft,
  busy,
  onUpdate,
  onRemove,
  onAdd,
  onReset,
  onSave,
  onCancel,
}: {
  draft: ScoringEntry[];
  busy: boolean;
  onUpdate: (index: number, patch: Partial<ScoringEntry>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="scoring-rows">
        {draft.map((entry, index) => (
          <div className="scoring-edit-row" key={index}>
            <label>
              Puntaje
              <input
                aria-label={"Puntaje " + (index + 1)}
                type="number"
                min={0}
                max={100}
                step={1}
                value={
                  Number.isNaN(entry.score_threshold)
                    ? ""
                    : entry.score_threshold
                }
                disabled={busy}
                onChange={(event) =>
                  onUpdate(index, {
                    score_threshold:
                      event.target.value === ""
                        ? NaN
                        : event.target.valueAsNumber,
                  })
                }
              />
            </label>
            <label>
              Significado
              <textarea
                aria-label={"Significado " + (index + 1)}
                rows={3}
                maxLength={2000}
                value={entry.meaning}
                disabled={busy}
                onChange={(event) =>
                  onUpdate(index, { meaning: event.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="text-button"
              aria-label={"Quitar puntaje " + (index + 1)}
              disabled={busy || draft.length === 1}
              onClick={() => onRemove(index)}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          disabled={busy || draft.length >= 101}
          onClick={onAdd}
        >
          Añadir puntaje
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onReset}
        >
          Usar guía inicial
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={onSave}
        >
          {busy ? "Guardando…" : "Guardar guía"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
