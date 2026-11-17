"use client";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDate } from "@/lib/journal/view-config";
import { LibraryPlaythrough, ReviewMark } from "./library-game-details";
import { GameCover } from "@/features/entries/game-cover";
import { InlineField } from "@/features/journal/inline/inline-field";
import { statuses } from "@/lib/types";

export function NotebookSummary({ entry }: { entry: JournalEntry }) {
  return (
          <div className="library-notebook-page is-current" data-entry-id={entry.id}>
              <div className="library-notebook-page-heading">
                <div className="library-notebook-cover"><GameCover cover={entry.cover} title={entry.title} size="feature" /></div>
                <div>
                  <h2><InlineField entry={entry} field="title" view="library">{entry.title}</InlineField></h2>
                  <p><InlineField entry={entry} field="device" view="library">{entry.device || entry.platforms || "Plataforma sin definir"}</InlineField></p>
                  <InlineField entry={entry} field="status" view="library"><span className={`status ${entry.status}`}>{statuses[entry.status]}</span></InlineField>
                </div>
                <div className="notebook-entry-actions">
                  <InlineField entry={entry} field="rating" view="library"><ReviewMark rating={entry.rating} /></InlineField>
                </div>
              </div>
              <div className="library-notebook-meta">
                <LibraryPlaythrough record={entry} inline />
              </div>
              <section className="library-notebook-reminder" aria-label="Recordatorio para la próxima partida">
                {/* <h3>Notas</h3> */}
                <InlineField entry={entry} field="reminder" view="library">
                  <span className="library-notebook-writing">{entry.reminder || "Agregar recordatorio"}</span>
                </InlineField>
              </section>
              <div className="library-notebook-notes">
                <h3>Notas finales</h3>
                <div className="notebook-summary-pair">
                <section><h4>Terminé:</h4> <InlineField entry={entry} field="finished" view="library">{formatDate(entry.finished) || "—"}</InlineField></section>
                <section><h4>Impresiones</h4><InlineField entry={entry} field="impression" view="library"><span className="library-notebook-writing">{entry.impression || "Agregar"}</span></InlineField></section>
                </div>
                <section><h4>Por qué</h4><InlineField entry={entry} field="reason" view="library"><span className="library-notebook-writing">{entry.reason || "Agregar"}</span></InlineField></section>
                <section><h4>Comentarios adicionales</h4><InlineField entry={entry} field="notes" view="library"><span className="library-notebook-writing">{entry.notes || "Agregar"}</span></InlineField></section>
              </div>
          </div>
  );
}
