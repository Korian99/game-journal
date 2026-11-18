"use client";
import { useEffect, useMemo, useState } from "react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { calculateRecap, type RecapPeriod } from "../recaps";
import { createRecapPng } from "../recap-export";
import { viewYears } from "@/lib/journal/view-config";
import { RecapExportForm, recapPreviewErrorMessage } from "./recap-export-form";
import { RecapPeriodControls } from "./recap-period-controls";
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
        if (active) setError(recapPreviewErrorMessage);
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
          <RecapPeriodControls
            period={selectedPeriod}
            yearOptions={yearOptions}
            onTypeChange={(type) => {
              setIncludeNote(false);
              setPeriodType(type);
            }}
            onMonthChange={setMonth}
            onYearChange={setYear}
          />
          <div className={styles.layout}>
            <RecapExportForm
              summary={summary}
              highlights={highlights}
              highlightId={highlightId}
              note={note}
              includeNote={includeNote}
              loading={loading}
              error={error}
              downloadDisabled={!png || loading || !!error}
              onHighlightChange={(value) => {
                setHighlightId(value);
                setIncludeNote(false);
              }}
              onNoteChange={(value) => {
                setNote(value);
                setIncludeNote(false);
              }}
              onIncludeNoteChange={setIncludeNote}
              onDownload={download}
            />
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
