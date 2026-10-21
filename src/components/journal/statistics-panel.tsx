"use client";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { statistics, estimateTargets } from "@/lib/journal/statistics";
import { viewYears } from "@/lib/journal/view-config";
import type { useJournalLocation } from "@/hooks/use-journal-location";
const number = (value: number | null, suffix = "") =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(
        value,
      ) + suffix;
export function StatisticsPanel({
  records,
  location,
}: {
  records: JournalEntry[];
  location: ReturnType<typeof useJournalLocation>;
}) {
  const {
    year,
    compareYear,
    estimateTarget,
    platform,
    setYear,
    setCompareYear,
    setEstimateTarget,
    setPlatform,
  } = location;
  const current = statistics(records, {
      year,
      target: estimateTarget,
      platform,
    }),
    comparison = statistics(records, {
      year: compareYear,
      target: estimateTarget,
      platform,
    });
  const years = [
    ...new Set([...viewYears(records, "library"), year, compareYear]),
  ]
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a));
  const platforms = [
    ...new Set(
      records.flatMap((record) =>
        (record.device + ";" + record.platforms)
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ),
  ].sort();
  const metrics = [
    { label: "Partidas", key: "total" },
    { label: "Juegos únicos", key: "uniqueGames" },
    { label: "Empecé", key: "started" },
    { label: "Terminé", key: "finished" },
    { label: "Finalización", key: "completionRate", suffix: "%" },
    { label: "Horas registradas", key: "hours", suffix: " h" },
    { label: "Reseña media", key: "averageRating", suffix: " /100" },
    { label: "Horas estimadas", key: "estimatedHours", suffix: " h" },
  ] as const;
  return (
    <section className="statistics">
      <div className="stats-controls panel">
        <label>
          Año
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
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
            onChange={(event) => setCompareYear(event.target.value)}
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
              setEstimateTarget(
                event.target.value as keyof typeof estimateTargets,
              )
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
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="">Todas</option>
            {platforms.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-metrics">
        {metrics.map((metric) => (
          <article className="panel stats-metric" key={metric.key}>
            <span className="eyebrow">{metric.label}</span>
            <strong>
              {number(
                current[metric.key],
                "suffix" in metric ? metric.suffix : "",
              )}
            </strong>
            {compareYear && (
              <small>
                {compareYear} ·{" "}
                {number(
                  comparison[metric.key],
                  "suffix" in metric ? metric.suffix : "",
                )}
              </small>
            )}
          </article>
        ))}
      </div>
      <p className="fine-print">
        Horas totales registradas en las partidas seleccionadas; pueden incluir
        tiempo jugado en otros años. Finalización: partidas con estado Terminado
        / partidas seleccionadas.
      </p>
      <div className="stats-details">
        <article className="panel">
          <h2>Por consola</h2>
          <table>
            <thead>
              <tr>
                <th>Consola</th>
                <th>Partidas</th>
                <th>Horas registradas</th>
              </tr>
            </thead>
            <tbody>
              {current.consoles.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.count}</td>
                  <td>{number(item.hours, " h")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!current.total && (
            <p className="muted">Sin partidas para este año.</p>
          )}
        </article>
        <article className="panel">
          <h2>Datos utilizados</h2>
          <p>
            {current.hoursCount} partidas con horas · {current.ratingCount}{" "}
            reseñas.
          </p>
          <p>
            {current.estimateCount} estimaciones para{" "}
            {estimateTargets[estimateTarget].toLowerCase()};{" "}
            {current.estimateSkipped} sin una estimación interpretable.
          </p>
          {compareYear && (
            <p>
              {compareYear}: {comparison.hoursCount} con horas,{" "}
              {comparison.ratingCount} reseñas y {comparison.estimateCount}{" "}
              estimaciones.
            </p>
          )}
          <p className="fine-print">
            Un número corresponde a historia. Tres valores corresponden a
            historia, extras y completista. Los rangos y textos ambiguos se
            omiten. Las horas de partidas con varios dispositivos se asignan a
            “Varias consolas”.
          </p>
        </article>
      </div>
    </section>
  );
}
