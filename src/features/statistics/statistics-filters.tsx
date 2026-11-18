import { estimateTargets, type EstimateTarget } from "./statistics";

export function StatisticsFilters({
  year,
  compareYear,
  estimateTarget,
  platform,
  years,
  platforms,
  onYearChange,
  onCompareYearChange,
  onTargetChange,
  onPlatformChange,
}: {
  year: string;
  compareYear: string;
  estimateTarget: EstimateTarget;
  platform: string;
  years: string[];
  platforms: string[];
  onYearChange: (year: string) => void;
  onCompareYearChange: (year: string) => void;
  onTargetChange: (target: EstimateTarget) => void;
  onPlatformChange: (platform: string) => void;
}) {
  return (
    <div className="stats-controls panel">
      <label>
        Año
        <select
          value={year}
          onChange={(event) => onYearChange(event.target.value)}
        >
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Comparar con
        <select
          value={compareYear}
          onChange={(event) => onCompareYearChange(event.target.value)}
        >
          <option value="">Sin comparación</option>
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Objetivo estimado
        <select
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
      <label>
        Consola / plataforma
        <select
          value={platform}
          onChange={(event) => onPlatformChange(event.target.value)}
        >
          <option value="">Todas</option>
          {platforms.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
