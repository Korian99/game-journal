"use client";
import { useEffect, useMemo, useState } from "react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { calculateRecap, type RecapPeriod } from "@/lib/journal/recaps";
import { createRecapPng, recapMonthName } from "@/lib/journal/recap-export";
import { viewYears } from "@/lib/journal/view-config";
import styles from "./recap-builder.module.css";

const currentArgentinaPeriod = (): Extract<RecapPeriod, { type: "month" }> => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  return {
    type: "month",
    year: Number(parts.find((part) => part.type === "year")!.value),
    month: Number(parts.find((part) => part.type === "month")!.value),
  };
};

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: recapMonthName(index + 1),
}));

export function RecapBuilder({
  records,
  recordsReady,
  recordsError,
  onBack,
}: {
  records: JournalEntry[];
  recordsReady: boolean;
  recordsError: boolean;
  onBack: () => void;
}) {
  const [period, setPeriod] = useState<RecapPeriod>(currentArgentinaPeriod);
  const [periodType, setPeriodType] = useState<"month" | "year">("month");
  const [highlightId, setHighlightId] = useState("");
  const [note, setNote] = useState("");
  const [includeNote, setIncludeNote] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [png, setPng] = useState<Blob>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("light") ? "light" : "dark",
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.classList.contains("light") ? "light" : "dark",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const selectedPeriod: RecapPeriod =
    periodType === "month"
      ? {
          type: "month",
          year: period.year,
          month:
            "month" in period ? period.month : currentArgentinaPeriod().month,
        }
      : { type: "year", year: period.year };
  const summary = calculateRecap(records, { period: selectedPeriod });
  const highlights = useMemo(() => {
    const unique = new Map<string, JournalEntry>();
    records.forEach((record, index) => {
      if (
        !calculateRecap([record], { period: selectedPeriod })
          .finishedPlaythroughs
      )
        return;
      const key = record.gameId
        ? "game:" + record.gameId
        : record.id
          ? "playthrough:" + record.id
          : "entry:" + index;
      if (!unique.has(key)) unique.set(key, record);
    });
    return [...unique.values()];
  }, [
    records,
    selectedPeriod.type,
    selectedPeriod.year,
    selectedPeriod.type === "month" ? selectedPeriod.month : 0,
  ]);
  const highlight = highlights.find(
    (record) => (record.gameId || record.id) === highlightId,
  );
  const exportNote = includeNote ? note : "";
  const yearOptions = [
    ...new Set([
      ...viewYears(records, "library").map(Number),
      currentArgentinaPeriod().year,
      selectedPeriod.year,
    ]),
  ].sort((a, b) => b - a);
  if (!yearOptions.includes(selectedPeriod.year))
    yearOptions.push(selectedPeriod.year);

  useEffect(() => {
    if (!recordsReady) return;
    let active = true;
    let nextUrl = "";
    setLoading(true);
    setPng(undefined);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
    setError("");
    createRecapPng({
      year: selectedPeriod.year,
      month: selectedPeriod.type === "month" ? selectedPeriod.month : undefined,
      finishedPlaythroughs: summary.finishedPlaythroughs,
      uniqueGames: summary.uniqueGamesFinished,
      excludedDates: summary.excludedCompletedWithoutFullFinishDate,
      highlightTitle: highlight?.title,
      cover: highlight?.cover,
      note: exportNote,
      includeNote: !!exportNote.trim(),
      theme,
    })
      .then((blob) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(blob);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return nextUrl;
        });
        setPng(blob);
      })
      .catch(() => {
        if (active)
          setError("No se pudo generar la vista previa. Probá de nuevo.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [
    recordsReady,
    selectedPeriod.year,
    selectedPeriod.type,
    selectedPeriod.type === "month" ? selectedPeriod.month : 0,
    theme,
    summary.finishedPlaythroughs,
    summary.uniqueGamesFinished,
    summary.excludedCompletedWithoutFullFinishDate,
    highlight?.title,
    highlight?.cover,
    exportNote,
    includeNote,
  ]);

  function setMonth(value: number) {
    setIncludeNote(false);
    setPeriodType("month");
    setPeriod((old) => ({ type: "month", year: old.year, month: value }));
  }
  function setYear(value: number) {
    setIncludeNote(false);
    setPeriod((old) => ({ ...old, year: value }));
  }
  function download() {
    if (!png) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = "mi-resumen-" + selectedPeriod.year + ".png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    setIncludeNote(false);
  }

  return (
    <section className={styles.builder} aria-labelledby="recap-heading">
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>TU AÑO, A TU MANERA</span>
          <h2 id="recap-heading">
            Resumen {selectedPeriod.type === "month" ? "mensual" : "anual"}
          </h2>
        </div>
        <button type="button" className="secondary" onClick={onBack}>
          Volver a estadísticas
        </button>
      </header>
      {!recordsReady ? (
        <p className="panel" role="status">
          {recordsError
            ? "No se pudieron cargar tus partidas. El resumen estará disponible cuando se carguen correctamente."
            : "Cargando tus partidas…"}
        </p>
      ) : (
        <>
          {recordsError && (
            <p className="fine-print" role="status">
              No se pudieron actualizar las partidas. El resumen usa los datos
              que ya estaban cargados.
            </p>
          )}
          <div className={styles.controls}>
            <label>
              Período
              <select
                value={periodType}
                onChange={(event) => {
                  setIncludeNote(false);
                  setPeriodType(event.target.value as "month" | "year");
                }}
              >
                <option value="month">Mes</option>
                <option value="year">Año</option>
              </select>
            </label>
            {selectedPeriod.type === "month" && (
              <label>
                Mes del resumen
                <select
                  aria-label="Mes del resumen"
                  value={selectedPeriod.month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Año del resumen
              <select
                aria-label="Año del resumen"
                value={selectedPeriod.year}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {yearOptions.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.layout}>
            <div className={styles.form}>
              <section className="panel">
                <span className={styles.kicker}>DATOS DEL PERÍODO</span>
                <p>
                  <strong>{summary.finishedPlaythroughs}</strong> partidas
                  terminadas
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
                  por fecha ausente, incompleta, aproximada o inválida en la
                  colección completa; no se puede asignar a un período.
                </p>
                <details>
                  <summary>Ver exclusiones</summary>
                  <p>
                    Faltantes: {summary.excludedFinishDateReasons.missing} ·
                    Parciales: {summary.excludedFinishDateReasons.partial} ·
                    Aproximadas: {summary.excludedFinishDateReasons.approximate}{" "}
                    · Inválidas: {summary.excludedFinishDateReasons.invalid}
                  </p>
                </details>
                <p className="fine-print">
                  Los inicios cuentan fechas registradas en el período; no
                  confirman actividad. Inicio registrado:{" "}
                  {summary.recordedStarts}.
                </p>
              </section>
              <label>
                Juego destacado
                <select
                  value={highlightId}
                  onChange={(event) => {
                    setHighlightId(event.target.value);
                    setIncludeNote(false);
                  }}
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
                  onChange={(event) => {
                    setNote(event.target.value);
                    setIncludeNote(false);
                  }}
                  rows={4}
                  placeholder="Agregá un recuerdo para acompañar el resumen"
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={includeNote}
                  onChange={(event) => setIncludeNote(event.target.checked)}
                />
                Incluir la nota en este PNG
              </label>
              <button
                type="button"
                className="primary"
                onClick={download}
                disabled={!png || loading || !!error}
              >
                Descargar PNG
              </button>
              {loading && <p role="status">Preparando la vista previa…</p>}
              {error && <p role="alert">{error}</p>}
            </div>
            <div className={styles.preview}>
              <span className={styles.kicker}>
                VISTA PREVIA · PNG 1080 × 1350
              </span>
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa del resumen" />
              ) : (
                <div className="panel">Preparando resumen…</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
