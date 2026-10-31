"use client";

import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { statuses } from "@/lib/types";
import { GameCover } from "../games/game-cover";

export function LibraryCoverGrid({
  entries,
  onQuickEdit,
  focusedEntry,
  entryRowClass,
}: {
  entries: JournalEntry[];
  onQuickEdit: (entry: JournalEntry) => void;
  focusedEntry: string;
  entryRowClass: (entry: JournalEntry) => string | undefined;
}) {
  return (
    <div
      className="library-cover-grid"
      aria-label="Biblioteca, vista de portadas"
    >
      {entries.map((entry) => (
        <article
          className={[
            "library-cover-card",
            entryRowClass(entry),
            entry.id === focusedEntry ? "notification-highlight" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-entry-id={entry.id}
          key={entry.id ?? entry.sourceKey}
        >
          <GameCover cover={entry.cover} title={entry.title} size="card" />
          <div className="library-cover-card-copy">
            <h2>{entry.title}</h2>
            <span className={`status ${entry.status}`}>
              {statuses[entry.status]}
            </span>
            <small>{entry.device || entry.platforms || "Sin plataforma"}</small>
            <small>Empecé: {formatDate(entry.started) || "—"}</small>
            <small>Terminé: {formatDate(entry.finished) || "—"}</small>
            <button
              className="library-cover-edit"
              type="button"
              onClick={() => onQuickEdit(entry)}
            >
              Editar {entry.title}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
