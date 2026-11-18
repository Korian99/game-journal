import type { JournalEntry } from "@/lib/journal/journal-types";
import { categoryLabels, findingLabels, type DataFinding } from "./data-checks";

export function DataCheckFindingsList({
  findings,
  hidden,
  moreCount,
  recordsReady,
  recordsError,
  online,
  navigationDisabled,
  dismissalDisabled,
  onView,
  onEdit,
  onReload,
  onToggleDismissal,
  onShowMore,
}: {
  findings: DataFinding[];
  hidden: (finding: DataFinding) => boolean;
  moreCount: number;
  recordsReady: boolean;
  recordsError: boolean;
  online: boolean;
  navigationDisabled: boolean;
  dismissalDisabled: boolean;
  onView: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  onReload: () => void;
  onToggleDismissal: (finding: DataFinding, isHidden: boolean) => void;
  onShowMore: () => void;
}) {
  return (
    <>
      {!recordsReady ? (
        <p role="status">
          {recordsError
            ? "No se pudieron cargar los juegos."
            : "Cargando juegos…"}
          <button className="text-button" disabled={!online} onClick={onReload}>
            Reintentar juegos
          </button>
        </p>
      ) : findings.length ? (
        <div className="data-check-list">
          {findings.map((finding) => {
            const isHidden = hidden(finding);
            const { kind } = finding;
            const title = finding.entry.title.trim() || "Juego sin nombre";
            return (
              <section
                className={
                  "data-check-finding " + (isHidden ? "is-hidden" : "")
                }
                key={finding.id}
              >
                <div>
                  <span className="eyebrow">
                    {categoryLabels[finding.category]}
                    {isHidden ? " · Oculto" : ""}
                  </span>
                  <h3>{title}</h3>
                  <strong>{findingLabels[finding.kind]}</strong>
                  <p>{finding.message}</p>
                </div>
                <div className="data-check-actions">
                  <button
                    className="secondary"
                    disabled={navigationDisabled}
                    aria-label={"Ver juego " + title}
                    onClick={() => onView(finding.entry)}
                  >
                    Ver juego
                  </button>
                  <button
                    className="secondary"
                    disabled={navigationDisabled}
                    aria-label={"Editar " + title}
                    onClick={() => onEdit(finding.entry)}
                  >
                    Editar
                  </button>
                  {kind !== "completion" && (
                    <button
                      className="text-button"
                      disabled={dismissalDisabled}
                      aria-label={
                        (isHidden ? "Mostrar aviso de " : "Ocultar aviso de ") +
                        title
                      }
                      onClick={() => onToggleDismissal(finding, isHidden)}
                    >
                      {isHidden ? "Volver a mostrar" : "Ocultar"}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="muted">No hay avisos con estos filtros.</p>
      )}
      {moreCount > 0 && (
        <button className="secondary" onClick={onShowMore}>
          Mostrar más avisos ({moreCount})
        </button>
      )}
    </>
  );
}
