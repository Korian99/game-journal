import { ArrowRight, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { OwnershipBadge } from "@/features/entries/ownership-badge";
import {
  estimateTargets,
  type EstimateTarget,
} from "@/features/statistics/statistics";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { releaseLabel } from "@/lib/releases";
import {
  numericPriority,
  type GameSuggestion,
  type gameSuggestions,
} from "./suggestions";

export function SuggestionResults({
  result,
  visible,
  offset,
  estimateTarget,
  platform,
  ready,
  loadError,
  online,
  blocked,
  dirty,
  savingId,
  onRetry,
  onView,
  onStart,
  onReset,
  onPreviousPage,
  onNextPage,
}: {
  result: ReturnType<typeof gameSuggestions>;
  visible: GameSuggestion[];
  offset: number;
  estimateTarget: EstimateTarget;
  platform: string;
  ready: boolean;
  loadError: boolean;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  savingId: string | null;
  onRetry: () => void;
  onView: (entry: JournalEntry) => void;
  onStart: (entry: JournalEntry) => void;
  onReset: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const number = (value: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  return (
    <>
      {!ready ? (
        <div className="panel empty" role="status">
          {loadError ? (
            <>
              <h2>No se pudieron cargar los juegos</h2>
              <button className="secondary" onClick={onRetry}>
                Reintentar
              </button>
            </>
          ) : (
            <p>Cargando juegos…</p>
          )}
        </div>
      ) : (
        <>
          <div className="suggestion-results-head">
            <p role="status">
              <strong>{result.items.length}</strong> opciones ·{" "}
              {result.unknownEstimates} sin estimación
              {platform && result.excluded.unknownPlatform > 0
                ? " · " +
                  result.excluded.unknownPlatform +
                  " sin consola confirmada"
                : ""}
            </p>
            <span className="muted">Prioridad → Hype → nombre</span>
          </div>
          {dirty && (
            <p className="banner">
              Guardá o cancelá la edición actual para abrir o empezar un juego.
            </p>
          )}
          {!online && (
            <p className="muted">
              Podés consultar los juegos cargados. Empezar o retomar requiere
              conexión.
            </p>
          )}
          {visible.length ? (
            <div className="suggestion-grid">
              {visible.map((item, index) => {
                const entry = item.entry,
                  paused = entry.status === "paused";
                return (
                  <article
                    className="suggestion-card"
                    key={entry.gameId ?? entry.id}
                  >
                    <div className="suggestion-card-top">
                      <span className="eyebrow">
                        OPCIÓN {offset + index + 1}
                      </span>
                      <span
                        className={"status " + (paused ? "paused" : "wishlist")}
                      >
                        {paused ? "En pausa" : "Sin empezar"}
                      </span>
                    </div>
                    <h2>{entry.title}</h2>
                    <div className="suggestion-access">
                      <OwnershipBadge value={entry.ownership} />
                    </div>
                    <dl className="suggestion-facts">
                      <div>
                        <dt>
                          Duración total · {estimateTargets[estimateTarget]}
                        </dt>
                        <dd>
                          {item.estimatedHours === null
                            ? "Sin estimación interpretable"
                            : number(item.estimatedHours) + " h"}
                        </dd>
                      </div>
                      <div>
                        <dt>Plataformas disponibles</dt>
                        <dd>{item.platforms.join(" · ") || "Sin confirmar"}</dd>
                      </div>
                      <div>
                        <dt>Prioridad / Hype</dt>
                        <dd>
                          {entry.priority === null ||
                          String(entry.priority).trim() === ""
                            ? "Sin prioridad"
                            : String(entry.priority) +
                              (numericPriority(entry.priority) === null
                                ? " (etiqueta)"
                                : "")}{" "}
                          · {entry.hype || "Sin Hype"}
                        </dd>
                      </div>
                    </dl>
                    {platform && (
                      <small className="muted">
                        Disponible en {platform}; comprobá tu acceso a esa
                        edición.
                      </small>
                    )}
                    {item.releaseUncertain && (
                      <small className="muted">
                        Lanzamiento por confirmar
                        {releaseLabel(entry) === "Sin fecha"
                          ? ""
                          : ": " + releaseLabel(entry)}
                      </small>
                    )}
                    <div className="suggestion-actions">
                      <button
                        className="secondary"
                        disabled={blocked || !!savingId}
                        aria-label={"Ver juego " + entry.title}
                        onClick={() => onView(entry)}
                      >
                        Ver juego
                        <ArrowRight size={15} />
                      </button>
                      <button
                        className="primary"
                        disabled={blocked || !online || !!savingId}
                        aria-label={
                          (paused ? "Retomar " : "Empezar ") + entry.title
                        }
                        onClick={() => onStart(entry)}
                      >
                        {savingId === entry.id ? (
                          <LoaderCircle size={15} className="save-spinner" />
                        ) : paused ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Play size={15} />
                        )}{" "}
                        {savingId === entry.id
                          ? "Guardando…"
                          : paused
                            ? "Retomar"
                            : "Empezar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="panel empty">
              <h2>No hay opciones con estos filtros</h2>
              <p>
                {result.eligibleCount
                  ? result.eligibleCount +
                    " juegos con acceso. " +
                    (result.excluded.platform +
                      result.excluded.unknownPlatform) +
                    " excluidos por consola, " +
                    result.excluded.duration +
                    " por duración y " +
                    result.excluded.unknownEstimate +
                    " sin estimación."
                  : "Se necesitan juegos sin empezar o en pausa, con compra o acceso familiar y sin un lanzamiento futuro confirmado."}
              </p>
              <button className="secondary" onClick={onReset}>
                Restablecer filtros
              </button>
            </div>
          )}
          {result.items.length > 3 && (
            <div className="suggestion-pagination">
              <span className="muted">
                {offset + 1}–{Math.min(offset + 3, result.items.length)} de{" "}
                {result.items.length}
              </span>
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={offset === 0 || !!savingId}
                  onClick={onPreviousPage}
                >
                  Opciones anteriores
                </button>
                <button
                  className="secondary"
                  disabled={offset + 3 >= result.items.length || !!savingId}
                  onClick={onNextPage}
                >
                  Ver más opciones
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
