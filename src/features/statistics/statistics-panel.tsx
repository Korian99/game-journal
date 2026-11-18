"use client";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { useState } from "react";
import { RecapBuilder } from "./recaps/recap-builder";
import { statistics, estimateTargets } from "./statistics";
import { viewYears } from "@/lib/journal/view-config";
import type { useJournalLocation } from "@/features/journal/use-journal-location";
import { ConsoleStatisticsTable } from "./console-statistics-table";
import { StatisticsFilters } from "./statistics-filters";
const number = (value: number | null, suffix = "") =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(
        value,
      ) + suffix;

export function StatisticsPanelHeader() {
  return (
    <div className="page-heading">
      <div>
        <h1>
          Estadísticas<span className="accent">.</span>
        </h1>
      </div>
    </div>
  );
}

export function StatisticsPanel({
  records,
  location,
  recordsReady = true,
  recordsError = false,
}: {
  records: JournalEntry[];
  location: ReturnType<typeof useJournalLocation>;
  recordsReady?: boolean;
  recordsError?: boolean;
}) {
  const [recapMode, setRecapMode] = useState(false);
  if (recapMode)
    return (
      <RecapBuilder
        records={records}
        recordsReady={recordsReady}
        recordsError={recordsError}
        onBack={() => setRecapMode(false)}
      />
    );
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
      <div className="panel" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="secondary"
          onClick={() => setRecapMode(true)}
        >
          Crear resumen
        </button>
      </div>
      <StatisticsFilters
        year={year}
        compareYear={compareYear}
        estimateTarget={estimateTarget}
        platform={platform}
        years={years}
        platforms={platforms}
        onYearChange={setYear}
        onCompareYearChange={setCompareYear}
        onTargetChange={setEstimateTarget}
        onPlatformChange={setPlatform}
      />
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
        <ConsoleStatisticsTable
          consoles={current.consoles}
          empty={!current.total}
          formatNumber={number}
        />
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
