"use client";

import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(0);
  const indexNav = useRef<HTMLElement>(null);
  const inlineEdit = useContext(InlineEditContext);
  const selectedEntry = entries.find((entry) => (entry.id ?? entry.sourceKey) === selectedId) ?? entries[0];
  const entriesKey = entries.map((entry) => entry.id ?? entry.sourceKey).join("|");
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const pageEntries = entries.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useLayoutEffect(() => {
    const nav = indexNav.current;
    if (!nav) return;
    const measure = () => {
      const spread = nav.closest<HTMLElement>(".library-notebook-spread");
      if (!spread) return;
      if (window.matchMedia("(max-width: 760px), (pointer: coarse)").matches) {
        const bottomNav = document.querySelector<HTMLElement>(".notebook-bottom-nav");
        const bottomHeight = bottomNav?.getBoundingClientRect().height ?? 0;
        const top = Math.max(0, spread.getBoundingClientRect().top);
        const availableHeight = Math.max(190, Math.min(620, window.innerHeight - top - bottomHeight - 18));
        spread.style.setProperty("--library-spread-height", `${availableHeight}px`);
      } else {
        spread.style.removeProperty("--library-spread-height");
      }
      const firstRow = nav.querySelector<HTMLElement>("button");
      if (!firstRow || nav.clientHeight <= 0) return;
      const rowHeight = firstRow.getBoundingClientRect().height;
      const gap = parseFloat(getComputedStyle(nav).rowGap) || 0;
      const nextSize = Math.max(1, Math.floor((nav.clientHeight + gap) / (rowHeight + gap)));
      setPageSize((current) => current === nextSize ? current : nextSize);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    observer.observe(nav.closest(".library-notebook-spread")!);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [presentation]);

  useEffect(() => setCurrentPage(0), [entriesKey]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId("");
      return;
    }
    const key = selectedEntry.id ?? selectedEntry.sourceKey;
    if (selectedId !== key) setSelectedId(key);
  }, [selectedEntry, selectedId]);

  useEffect(() => {
    if (!focusedEntry) return;
    const focusedIndex = entries.findIndex((entry) => entry.id === focusedEntry);
    if (focusedIndex < 0) return;
    setSelectedId(focusedEntry);
    setCurrentPage(Math.floor(focusedIndex / pageSize));
    setShowingPage(true);
  }, [entriesKey, focusedEntry, pageSize]);

  if (view === "library" && presentation === "notebook") {
    return (
      <section className="library-notebook-spread" aria-label="Cuaderno de Biblioteca">
        <aside className={`library-notebook-index${showingPage ? " is-away" : ""}`}>
          <h2>Índice</h2>
          <nav ref={indexNav} aria-label="Juegos de la Biblioteca">
            {pageEntries.map((entry) => (
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
          {pageCount > 1 && <div className="library-notebook-pagination" role="group" aria-label="Paginación del índice">
            <button type="button" aria-label="Página anterior" disabled={currentPage === 0 || !!inlineEdit?.dirty || !!inlineEdit?.saving} onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}>Anterior</button>
            <span aria-live="polite">Página {currentPage + 1} de {pageCount}</span>
            <button type="button" aria-label="Página siguiente" disabled={currentPage >= pageCount - 1 || !!inlineEdit?.dirty || !!inlineEdit?.saving} onClick={() => setCurrentPage((page) => Math.min(pageCount - 1, page + 1))}>Siguiente</button>
          </div>}
        </aside>
        <article className={`library-notebook-page${showingPage ? " is-current" : ""}`} data-entry-id={selectedEntry?.id} tabIndex={-1}>
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
              <section className="library-notebook-reminder" aria-label="Recordatorio para la próxima partida">
                {/* <h3>Notas</h3> */}
                <InlineField entry={selectedEntry} field="reminder" view="library">
                  <span className="library-notebook-writing">{selectedEntry.reminder || "Agregar recordatorio"}</span>
                </InlineField>
              </section>
              <div className="library-notebook-meta">
                <LibraryPlaythrough record={selectedEntry} inline />
                <span><b>Terminé:</b> <InlineField entry={selectedEntry} field="finished" view="library">{formatDate(selectedEntry.finished) || "—"}</InlineField></span>
              </div>
              <div className="library-notebook-notes">
                <h3>Notas finales</h3>
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
