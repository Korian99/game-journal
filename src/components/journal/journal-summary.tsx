"use client";

import type { JournalView } from "@/lib/journal/journal-location";
import { summarizeGames } from "@/lib/journal/view-summary";

export function JournalSummary({
  summary,
  view,
  selectedYear,
}: {
  summary: ReturnType<typeof summarizeGames>;
  view: JournalView;
  selectedYear: string;
}) {
  return (
    <section className="collection-summary" aria-label="Resumen filtrado">
      <div className="stats filtered-stats">
        <div data-stat="total">
          <span>JUEGOS</span>
          <strong>{summary.total}</strong>
        </div>
        <div
          data-stat="started"
          title={
            view === "library" && selectedYear
              ? "Con fecha de inicio en " + selectedYear
              : "Con fecha de inicio"
          }
        >
          <span>EMPECÉ</span>
          <strong>{summary.started}</strong>
        </div>
        <div
          data-stat="finished"
          title={
            view === "library" && selectedYear
              ? "Con fecha de fin en " + selectedYear
              : "Con fecha de fin"
          }
        >
          <span>TERMINÉ</span>
          <strong>{summary.finished}</strong>
        </div>
        <div data-stat="playing">
          <span>JUGANDO</span>
          <strong>{summary.playing}</strong>
        </div>
        <div
          data-stat="hours"
          title={summary.hoursCount + " con horas registradas"}
        >
          <span>HORAS</span>
          <strong>
            {summary.hours.toLocaleString("es-AR", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
        {view === "library" && (
          <div data-stat="rating" title={summary.ratingCount + " reseñas"}>
            <span>RESEÑA MEDIA</span>
            <strong>
              {summary.averageRating === null
                ? "—"
                : summary.averageRating.toLocaleString("es-AR", {
                    maximumFractionDigits: 1,
                  })}
              {summary.averageRating !== null && <small>/100</small>}
            </strong>
          </div>
        )}
      </div>
      <section className="console-summary" aria-label="Juegos por consola">
        <h2>Juegos por consola</h2>
        {summary.consoles.length ? (
          <ul>
            {summary.consoles.map(({ name, count }) => (
              <li key={name}>
                <span>{name}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay juegos para estos filtros.</p>
        )}
      </section>
    </section>
  );
}
