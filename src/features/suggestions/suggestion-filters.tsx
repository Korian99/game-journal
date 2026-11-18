import {
  estimateTargets,
  type EstimateTarget,
} from "@/features/statistics/statistics";

export function SuggestionFilters({
  platform,
  availablePlatforms,
  suggestionHours,
  estimateTarget,
  suggestionUnknownEstimates,
  onPlatformChange,
  onHoursChange,
  onTargetChange,
  onIncludeUnknownChange,
}: {
  platform: string;
  availablePlatforms: string[];
  suggestionHours: string;
  estimateTarget: EstimateTarget;
  suggestionUnknownEstimates: boolean;
  onPlatformChange: (platform: string) => void;
  onHoursChange: (hours: string) => void;
  onTargetChange: (target: EstimateTarget) => void;
  onIncludeUnknownChange: (include: boolean) => void;
}) {
  return (
    <div className="suggestion-controls panel">
      <label>
        Consola
        <select
          aria-label="Consola"
          value={platform}
          onChange={(event) => onPlatformChange(event.target.value)}
        >
          <option value="">Todas las consolas</option>
          {availablePlatforms.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Duración total máxima (h)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="100000"
          step="any"
          placeholder="Sin límite"
          value={suggestionHours}
          onChange={(event) => onHoursChange(event.target.value)}
        />
      </label>
      <label>
        Objetivo estimado
        <select
          aria-label="Objetivo estimado"
          value={estimateTarget}
          onChange={(event) =>
            onTargetChange(event.target.value as EstimateTarget)
          }
        >
          {Object.entries(estimateTargets).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {suggestionHours !== "" && (
        <label className="suggestion-unknown">
          <input
            type="checkbox"
            checked={suggestionUnknownEstimates}
            onChange={(event) => onIncludeUnknownChange(event.target.checked)}
          />
          Incluir duración desconocida
        </label>
      )}
    </div>
  );
}
