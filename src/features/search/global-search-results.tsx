import type { KeyboardEventHandler, RefObject } from "react";
import { ArrowDownLeft } from "lucide-react";
import { GameCover } from "@/features/entries/game-cover";
import { effectiveCoverUrl } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { statuses } from "@/lib/types";
import type { SearchGroup } from "./search";

export function GlobalSearchResults({
  ready,
  hasQuery,
  failed,
  groupCount,
  total,
  visible,
  moreCount,
  disabled,
  resultsRef,
  onKeyDown,
  onChoose,
  onShowMore,
}: {
  ready: boolean;
  hasQuery: boolean;
  failed: boolean;
  groupCount: number;
  total: number;
  visible: SearchGroup[];
  moreCount: number;
  disabled: boolean;
  resultsRef: RefObject<HTMLDivElement | null>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onChoose: (entry: JournalEntry) => void;
  onShowMore: () => void;
}) {
  return (
    <>
      {ready && !hasQuery && (
        <p className="global-search-empty">
          Buscá entre todos tus juegos, sin los filtros de la lista.
        </p>
      )}
      {ready && hasQuery && !groupCount && (
        <p className="global-search-empty">No hay coincidencias.</p>
      )}
      {failed && (
        <p role="alert" className="error">
          La partida ya no está disponible. Volvé a buscar.
        </p>
      )}
      {groupCount > 0 && (
        <p className="global-search-count" role="status">
          {groupCount} {groupCount === 1 ? "juego" : "juegos"} · {total}{" "}
          {total === 1 ? "partida" : "partidas"}
        </p>
      )}
      <div
        ref={resultsRef}
        className="global-search-results"
        onKeyDown={onKeyDown}
      >
        {visible.map((group) => (
          <section className="global-search-group" key={group.key}>
            <div className="global-search-group-heading">
              <GameCover
                cover={
                  group.entries.find((entry) => effectiveCoverUrl(entry.cover))
                    ?.cover
                }
                title={group.title}
              />
              <h3>{group.title}</h3>
            </div>
            {group.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="global-search-result"
                data-search-result
                disabled={disabled}
                aria-label={[
                  "Abrir partida",
                  entry.title,
                  statuses[entry.status],
                  entry.device || entry.platforms || "Sin consola",
                  entry.period,
                  formatDate(entry.started),
                  formatDate(entry.finished),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onClick={() => onChoose(entry)}
              >
                <span className={"status " + entry.status}>
                  {statuses[entry.status]}
                </span>
                <span className="global-search-result-meta">
                  <span>
                    {entry.device || entry.platforms || "Sin consola"}
                  </span>
                  <small>
                    {[
                      entry.period,
                      entry.started
                        ? "Empecé: " + formatDate(entry.started)
                        : "",
                      entry.finished
                        ? "Terminé: " + formatDate(entry.finished)
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin período registrado"}
                  </small>
                </span>
                <ArrowDownLeft size={15} aria-hidden="true" />
              </button>
            ))}
          </section>
        ))}
      </div>
      {moreCount > 0 && (
        <button
          type="button"
          className="secondary global-search-more"
          onClick={onShowMore}
        >
          Mostrar más partidas ({moreCount})
        </button>
      )}
    </>
  );
}
