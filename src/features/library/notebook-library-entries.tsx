"use client";

import type { ReactNode } from "react";
import { statuses } from "@/lib/types";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { GameComments } from "@/features/journal/game-comments";
import { LibraryPlaythrough, ReviewMark } from "./library-game-details";
import { Pencil } from "lucide-react";
import { GameRowArtwork } from "@/features/entries/game-cover";
import { NotebookSummary } from "./notebook-summary";

export function NotebookLibraryEntries({
  entries,
  focusedEntry,
  entryRowClass,
  onQuickEdit,
  view = "library",
  detailEntryId = "",
  detailEntry,
  detailEditor,
}: {
  entries: JournalEntry[];
  focusedEntry: string;
  entryRowClass: (entry: JournalEntry) => string | undefined;
  onQuickEdit: (entry: JournalEntry) => void;
  view?: "library" | "journal";
  detailEntryId?: string;
  detailEntry?: JournalEntry;
  detailEditor?: (summary: ReactNode) => ReactNode;
}) {
  const selectedEntry = detailEntry ?? entries.find((entry) => (entry.id ?? entry.sourceKey) === detailEntryId);

  if (view === "library" && detailEntryId) {
    return (
      <section className="library-notebook-spread is-detail" aria-label="Detalle del juego">
        {selectedEntry ? detailEditor?.(
          <NotebookSummary entry={selectedEntry} />,
        ) ?? <p className="library-notebook-empty-note">No hay juegos en esta selección.</p> : null}
      </section>
    );
  }

  return (
    <>
      <div className="notebook-entry-list">
      {entries.map((entry) => (
        <article
          className={[
            "mobile-game",
            "mobile-game-played",
            "notebook-entry-card",
            entryRowClass(entry),
            entry.id === focusedEntry ? "notification-highlight" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={entry.id ?? entry.sourceKey}
          data-entry-id={entry.id}
          tabIndex={-1}
        >
          <GameRowArtwork cover={entry.cover} />
          <div className="notebook-entry-main">
            <div className="notebook-entry-identity">
              <h2>{entry.title}</h2>
              <p>
                {entry.device || entry.platforms || "Plataforma sin definir"}
                {view === "journal" &&
                  ` · Año ${entry.year || "—"} · Período ${entry.period || "—"}`}
              </p>
              <span className={"status " + entry.status}>
                {statuses[entry.status]}
              </span>
            </div>
            <div className="notebook-entry-actions">
              <ReviewMark rating={entry.rating} />
              <button
                type="button"
                className="mobile-edit-button"
                data-quick-edit-id={entry.id}
                aria-label={"Editar rápidamente " + entry.title}
                title="Editar"
                onClick={() => onQuickEdit(entry)}
              >
                <Pencil size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="notebook-entry-playthrough">
            <LibraryPlaythrough record={entry} />
            <span className="notebook-entry-finished">
              <span>Terminé:</span> {formatDate(entry.finished) || "—"}
            </span>
          </div>

          {(entry.reason.trim() ||
            entry.impression.trim() ||
            entry.review_details.trim()) && (
            <details className="notebook-entry-reflections">
              <summary>
                <span className="notebook-reflection-closed">
                  Leer comentarios
                </span>
                <span className="notebook-reflection-open">
                  Ocultar comentarios
                </span>
              </summary>
              <div className="notebook-entry-reflection-content">
                {entry.reason.trim() && (
                  <section>
                    <h3>Por qué</h3>
                    <p>{entry.reason}</p>
                  </section>
                )}
                {entry.impression.trim() && (
                  <section>
                    <h3>Impresiones</h3>
                    <p>{entry.impression}</p>
                  </section>
                )}
                {entry.review_details.trim() && <GameComments entry={entry} />}
              </div>
            </details>
          )}
        </article>
      ))}
      </div>
    </>
  );
}
