import {
  categoryLabels,
  findingFilterKinds,
  findingLabels,
  preferenceLabels,
  type DataCheckState,
  type FindingCategory,
  type FindingFilterKind,
} from "./data-checks";

export function DataCheckControls({
  preferences,
  preferencesDisabled,
  countCategory,
  hiddenCount,
  category,
  kind,
  showHidden,
  onPreferenceChange,
  onCategoryChange,
  onKindChange,
  onShowHiddenChange,
}: {
  preferences: DataCheckState["preferences"];
  preferencesDisabled: boolean;
  countCategory: (category: string) => number;
  hiddenCount: number;
  category: FindingCategory | "";
  kind: FindingFilterKind | "";
  showHidden: boolean;
  onPreferenceChange: (
    key: keyof typeof preferenceLabels,
    enabled: boolean,
  ) => void;
  onCategoryChange: (category: FindingCategory | "") => void;
  onKindChange: (kind: FindingFilterKind | "") => void;
  onShowHiddenChange: (show: boolean) => void;
}) {
  return (
    <>
      <fieldset
        className="data-check-preferences"
        disabled={preferencesDisabled}
      >
        <legend>Recordatorios opcionales</legend>
        {(
          Object.keys(preferenceLabels) as (keyof typeof preferenceLabels)[]
        ).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              aria-label={preferenceLabels[key]}
              checked={preferences[key]}
              onChange={(event) =>
                onPreferenceChange(key, event.target.checked)
              }
            />
            {preferenceLabels[key]}
          </label>
        ))}
      </fieldset>
      <div className="data-check-counts">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <span key={key}>
            {label}: <strong>{countCategory(key)}</strong>
          </span>
        ))}
        <span>
          Ocultos: <strong>{hiddenCount}</strong>
        </span>
      </div>
      <div className="data-check-controls">
        <label>
          Categoría
          <select
            aria-label="Categoría de aviso"
            value={category}
            onChange={(event) =>
              onCategoryChange(event.target.value as FindingCategory | "")
            }
          >
            <option value="">Todas</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de aviso
          <select
            aria-label="Tipo de aviso"
            value={kind}
            onChange={(event) =>
              onKindChange(event.target.value as FindingFilterKind | "")
            }
          >
            <option value="">Todos</option>
            {findingFilterKinds.map((key) => (
              <option key={key} value={key}>
                {findingLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="data-check-hidden">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => onShowHiddenChange(event.target.checked)}
          />
          Mostrar ocultos
        </label>
      </div>
    </>
  );
}
