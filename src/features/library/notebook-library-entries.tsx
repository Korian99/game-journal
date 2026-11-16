"use client";

import { useContext, useEffect, useState } from "react";
import { statuses } from "@/lib/types";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { GameComments } from "@/features/journal/game-comments";
import { LibraryPlaythrough, ReviewMark } from "./library-game-details";
import { Pencil } from "lucide-react";
import { GameCover, GameRowArtwork } from "@/features/entries/game-cover";
import { InlineEditContext } from "@/features/journal/inline/inline-context";
import { InlineField } from "@/features/journal/inline/inline-field";

export function NotebookLibraryEntries({
  entries,
  focusedEntry,
  entryRowClass,
  onQuickEdit,
  view = "library",
  presentation = "notebook",
}: {
  entries: JournalEntry[];
  focusedEntry: string;
  entryRowClass: (entry: JournalEntry) => string | undefined;
  onQuickEdit: (entry: JournalEntry) => void;
  view?: "library" | "journal";
  presentation?: "notebook" | "list";
}) {
  const [selectedId, setSelectedId] = useState("");
  const [showingPage, setShowingPage] = useState(false);
  const inlineEdit = useContext(InlineEditContext);
  const selectedEntry = entries.find((entry) => (entry.id ?? entry.sourceKey) === selectedId) ?? entries[0];

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId("");
      return;
    }
    const key = selectedEntry.id ?? selectedEntry.sourceKey;
    if (selectedId !== key) setSelectedId(key);
  }, [selectedEntry, selectedId]);

  useEffect(() => {
    if (!focusedEntry || !entries.some((entry) => entry.id === focusedEntry)) return;
    setSelectedId(focusedEntry);
    setShowingPage(true);
  }, [entries, focusedEntry]);

  if (view === "library" && presentation === "notebook") {
    return (
      <section className="library-notebook-spread" aria-label="Cuaderno de Biblioteca">
        <aside className={`library-notebook-index${showingPage ? " is-away" : ""}`}>
          <h2>Índice</h2>
          <nav aria-label="Juegos de la Biblioteca">
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.id ?? entry.sourceKey}
                data-entry-id={entry.id}
                aria-label={`${entry.title}, ${statuses[entry.status]}`}
                className={(entry.id ?? entry.sourceKey) === (selectedEntry?.id ?? selectedEntry?.sourceKey) ? "is-selected" : ""}
                aria-current={(entry.id ?? entry.sourceKey) === (selectedEntry?.id ?? selectedEntry?.sourceKey) ? "page" : undefined}
                disabled={!!inlineEdit?.dirty || !!inlineEdit?.saving}
                onClick={() => {
                  setSelectedId(entry.id ?? entry.sourceKey);
                  setShowingPage(true);
                }}
              >
                <GameCover cover={entry.cover} title={entry.title} />
                <span>{entry.title}</span>
                <small>{statuses[entry.status]}</small>
              </button>
            ))}
          </nav>
        </aside>
        <article className={`library-notebook-page${showingPage ? " is-current" : ""}`}>
          {selectedEntry ? (
            <>
              <button className="library-notebook-back" type="button" disabled={!!inlineEdit?.dirty || !!inlineEdit?.saving} onClick={() => setShowingPage(false)}>
                ← Biblioteca
              </button>
              <div className="library-notebook-page-heading">
                <div className="library-notebook-cover"><GameCover cover={selectedEntry.cover} title={selectedEntry.title} size="feature" /></div>
                <div>
                  <h2><InlineField entry={selectedEntry} field="title" view="library">{selectedEntry.title}</InlineField></h2>
                  <p><InlineField entry={selectedEntry} field="device" view="library">{selectedEntry.device || selectedEntry.platforms || "Plataforma sin definir"}</InlineField></p>
                  <InlineField entry={selectedEntry} field="status" view="library"><span className={`status ${selectedEntry.status}`}>{statuses[selectedEntry.status]}</span></InlineField>
                </div>
                <div className="notebook-entry-actions">
                  <InlineField entry={selectedEntry} field="rating" view="library"><ReviewMark rating={selectedEntry.rating} /></InlineField>
                  <button
                    type="button"
                    className="mobile-edit-button"
                    data-quick-edit-id={selectedEntry.id}
                    aria-label={`Editar rápidamente ${selectedEntry.title}`}
                    title="Editar"
                    onClick={() => onQuickEdit(selectedEntry)}
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="library-notebook-meta">
                <LibraryPlaythrough record={selectedEntry} inline />
                <span><b>Terminé:</b> <InlineField entry={selectedEntry} field="finished" view="library">{formatDate(selectedEntry.finished) || "—"}</InlineField></span>
              </div>
              <div className="library-notebook-notes">
                <h3>Notas personales</h3>
                <section><h4>Por qué</h4><InlineField entry={selectedEntry} field="reason" view="library"><span className="library-notebook-writing">{selectedEntry.reason || "Agregar"}</span></InlineField></section>
                <section><h4>Impresiones</h4><InlineField entry={selectedEntry} field="impression" view="library"><span className="library-notebook-writing">{selectedEntry.impression || "Agregar"}</span></InlineField></section>
                <section><h4>Comentarios adicionales</h4><InlineField entry={selectedEntry} field="notes" view="library"><span className="library-notebook-writing">{selectedEntry.notes || "Agregar"}</span></InlineField></section>
              </div>
            </>
          ) : <p className="library-notebook-empty-note">No hay juegos en esta selección.</p>}
        </article>
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
            entry.notes.trim()) && (
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
                {entry.notes.trim() && <GameComments entry={entry} />}
              </div>
            </details>
          )}
        </article>
      ))}
      </div>
    </>
  );
}
