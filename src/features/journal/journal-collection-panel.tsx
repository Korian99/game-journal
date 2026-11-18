import type { ComponentProps } from "react";
import { Gamepad2 } from "lucide-react";
import { JournalSummary } from "@/features/library/journal-summary";
import type { JournalView } from "@/lib/journal/journal-location";
import { InlineEditContext } from "./inline/inline-context";
import { JournalGameTable } from "./journal-game-table";
import type { InlineEditing } from "./use-inline-editing";

export function CollectionEmptyState({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Gamepad2 size={34} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function JournalCollectionPanel({
  view,
  loading,
  resultsCount,
  hasRecords,
  recordsError,
  inlineEditing,
  tableProps,
}: {
  view: JournalView;
  loading: boolean;
  resultsCount: number;
  hasRecords: boolean;
  recordsError: boolean;
  inlineEditing: InlineEditing;
  tableProps: Omit<ComponentProps<typeof JournalGameTable>, "view">;
}) {
  const unavailable = recordsError && !hasRecords;
  return (
    <div className="collection-layout">
      <section className="table-panel">
        <div className="table-caption">
          <span>
            {loading
              ? "Cargando…"
              : resultsCount + " " + (resultsCount === 1 ? "juego" : "juegos")}
          </span>
        </div>
        {!loading && resultsCount === 0 && !tableProps.detailEntry ? (
          <CollectionEmptyState
            title={unavailable ? "No se pudieron cargar los juegos" : "No hay juegos"}
            text={
              unavailable
                ? "Reintentá la carga cuando vuelva la conexión."
                : hasRecords
                  ? "Cambiá los filtros o agregá un juego."
                  : "Agregá un juego o importá desde Configuración."
            }
          />
        ) : (
          <InlineEditContext.Provider value={inlineEditing}>
            <JournalGameTable {...tableProps} view={view} />
          </InlineEditContext.Provider>
        )}
      </section>
    </div>
  );
}

export function JournalCollectionSummary({
  summary,
  view,
  selectedYear,
}: ComponentProps<typeof JournalSummary>) {
  return (
    <details className="notebook-library-summary">
      <summary>Ver resumen de {selectedYear || "todos los años"}</summary>
      <JournalSummary summary={summary} view={view} selectedYear={selectedYear} />
    </details>
  );
}
