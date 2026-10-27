"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Play, RotateCcw } from "lucide-react";
import type { useJournalLocation } from "@/hooks/use-journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";
import { gameSuggestions, numericPriority } from "@/lib/journal/suggestions";
import { estimateTargets } from "@/lib/journal/statistics";
import { releaseLabel } from "@/lib/releases";
import { OwnershipBadge } from "@/components/games/ownership-badge";

type Props = {
  records: JournalEntry[];
  offers: Offer[];
  now: Date;
  location: ReturnType<typeof useJournalLocation>;
  ready: boolean;
  loadError: boolean;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  onRetry: () => void;
  onView: (entry: JournalEntry) => void;
  onStart: (entry: JournalEntry) => Promise<void>;
};
export function SuggestionsPanel({
  records,
  offers,
  now,
  location,
  ready,
  loadError,
  online,
  blocked,
  dirty,
  onRetry,
  onView,
  onStart,
}: Props) {
  const {
    platform,
    suggestionHours,
    estimateTarget,
    suggestionUnknownEstimates,
  } = location;
  const result = useMemo(
    () =>
      gameSuggestions(
        records,
        offers,
        {
          platform,
          maxHours: suggestionHours === "" ? null : Number(suggestionHours),
          target: estimateTarget,
          includeUnknownEstimates: suggestionUnknownEstimates,
        },
        now,
      ),
    [
      records,
      offers,
      platform,
      suggestionHours,
      estimateTarget,
      suggestionUnknownEstimates,
      now,
    ],
  );
  const filterKey = JSON.stringify([
    platform,
    suggestionHours,
    estimateTarget,
    suggestionUnknownEstimates,
  ]);
  const [page, setPage] = useState({ key: filterKey, offset: 0 });
  const offset =
    page.key === filterKey
      ? Math.min(
          page.offset,
          Math.max(0, Math.ceil(result.items.length / 3) - 1) * 3,
        )
      : 0;
  const visible = result.items.slice(offset, offset + 3);
  const [savingId, setSavingId] = useState<string | null>(null);
  const saving = useRef(false);
  const number = (value: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  async function start(entry: JournalEntry) {
    if (saving.current || blocked || !online) return;
    saving.current = true;
    setSavingId(entry.id ?? null);
    try {
      await onStart(entry);
    } finally {
      saving.current = false;
      setSavingId(null);
    }
  }
  const availablePlatforms = Array.from(
    new Set([...result.platforms, ...(platform ? [platform] : [])]),
  );
  return (
    <section className="suggestions" aria-label="Sugerencias de juegos">
      <p className="muted suggestions-intro">
        Sin empezar o en pausa, con compra o acceso familiar.
      </p>
      <div className="suggestion-controls panel">
        <label>
          Consola
          <select
            aria-label="Consola"
            value={platform}
            onChange={(event) => location.setPlatform(event.target.value)}
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
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "" ||
                (Number.isFinite(Number(value)) &&
                  Number(value) >= 0 &&
                  Number(value) <= 100000)
              )
                location.setSuggestionHours(value);
            }}
          />
        </label>
        <label>
          Objetivo estimado
          <select
            aria-label="Objetivo estimado"
            value={estimateTarget}
            onChange={(event) =>
              location.setEstimateTarget(
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
        {suggestionHours !== "" && (
          <label className="suggestion-unknown">
            <input
              type="checkbox"
              checked={suggestionUnknownEstimates}
              onChange={(event) =>
                location.setSuggestionUnknownEstimates(event.target.checked)
              }
            />
            Incluir duración desconocida
          </label>
        )}
      </div>
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
                        onClick={() => void start(entry)}
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
              <button className="secondary" onClick={location.resetSuggestions}>
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
                  onClick={() =>
                    setPage({ key: filterKey, offset: Math.max(0, offset - 3) })
                  }
                >
                  Opciones anteriores
                </button>
                <button
                  className="secondary"
                  disabled={offset + 3 >= result.items.length || !!savingId}
                  onClick={() =>
                    setPage({ key: filterKey, offset: offset + 3 })
                  }
                >
                  Ver más opciones
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
