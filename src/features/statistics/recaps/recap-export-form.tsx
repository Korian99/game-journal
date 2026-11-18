import type { JournalEntry } from "@/lib/journal/journal-types";
import type { calculateRecap } from "../recaps";
import styles from "./recap-builder.module.css";

export const recapPreviewErrorMessage =
  "No se pudo generar la vista previa. Probá de nuevo.";

export function RecapExportForm({
  summary,
  highlights,
  highlightId,
  note,
  includeNote,
  loading,
  error,
  downloadDisabled,
  onHighlightChange,
  onNoteChange,
  onIncludeNoteChange,
  onDownload,
}: {
  summary: ReturnType<typeof calculateRecap>;
  highlights: JournalEntry[];
  highlightId: string;
  note: string;
  includeNote: boolean;
  loading: boolean;
  error: string;
  downloadDisabled: boolean;
  onHighlightChange: (id: string) => void;
  onNoteChange: (note: string) => void;
  onIncludeNoteChange: (include: boolean) => void;
  onDownload: () => void;
}) {
  return (
    <div className={styles.form}>
      <section className="panel">
        <span className={styles.kicker}>DATOS DEL PERÍODO</span>
        <p>
          <strong>{summary.finishedPlaythroughs}</strong> partidas terminadas
        </p>
        <p>
          <strong>{summary.uniqueGamesFinished}</strong> juegos únicos
          terminados
        </p>
        <p>
          {summary.excludedCompletedWithoutFullFinishDate}{" "}
          {summary.excludedCompletedWithoutFullFinishDate === 1
            ? "partida terminada excluida"
            : "partidas terminadas excluidas"}{" "}
          por fecha ausente, incompleta, aproximada o inválida en la colección
          completa; no se puede asignar a un período.
        </p>
        <details>
          <summary>Ver exclusiones</summary>
          <p>
            Faltantes: {summary.excludedFinishDateReasons.missing} · Parciales:{" "}
            {summary.excludedFinishDateReasons.partial} · Aproximadas:{" "}
            {summary.excludedFinishDateReasons.approximate} · Inválidas:{" "}
            {summary.excludedFinishDateReasons.invalid}
          </p>
        </details>
        <p className="fine-print">
          Los inicios cuentan fechas registradas en el período; no confirman
          actividad. Inicio registrado: {summary.recordedStarts}.
        </p>
      </section>
      <label>
        Juego destacado
        <select
          value={highlightId}
          onChange={(event) => onHighlightChange(event.target.value)}
        >
          <option value="">Sin juego destacado</option>
          {highlights.map((record) => (
            <option
              key={record.gameId || record.id}
              value={record.gameId || record.id}
            >
              {record.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nota (opcional)
        <textarea
          value={note}
          maxLength={500}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={4}
          placeholder="Agregá un recuerdo para acompañar el resumen"
        />
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={includeNote}
          onChange={(event) => onIncludeNoteChange(event.target.checked)}
        />
        Incluir la nota en este PNG
      </label>
      <button
        type="button"
        className="primary"
        onClick={onDownload}
        disabled={downloadDisabled}
      >
        Descargar PNG
      </button>
      {loading && <p role="status">Preparando la vista previa…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
