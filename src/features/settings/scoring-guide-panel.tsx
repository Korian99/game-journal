"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import {
  defaultScoringGuide,
  scoringGuideSchema,
  type ScoringEntry,
} from "./scoring-guide";
import { ScoringGuideForm, scoringGuideFormMessages } from "./scoring-guide-form";

export function ScoringGuide({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<ScoringEntry[] | null>(null);
  const [draft, setDraft] = useState<ScoringEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(
      "/api/scoring",
      "GET",
      undefined,
      scoringGuideSchema,
      controller.signal,
    )
      .then((guide) => {
        setSaved(guide.entries);
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la guía.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  function update(index: number, patch: Partial<ScoringEntry>) {
    setDraft((values) =>
      values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
    setError("");
    setNotice("");
  }
  function addScore() {
    const score = Array.from({ length: 101 }, (_, i) => 100 - i).find(
      (score) => !draft.some((entry) => entry.score_threshold === score),
    );
    if (score !== undefined)
      setDraft((values) => [...values, { score_threshold: score, meaning: "" }]);
  }
  function restoreDefaultDraft() {
    if (window.confirm(scoringGuideFormMessages.reset))
      setDraft(defaultScoringGuide.map((entry) => ({ ...entry })));
  }
  async function save() {
    const parsed = scoringGuideSchema.safeParse({ entries: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(
        "/api/scoring",
        "PUT",
        parsed.data,
        scoringGuideSchema,
      );
      setSaved(result.entries);
      setDraft(result.entries);
      setEditing(false);
      setNotice("Guía guardada.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : scoringGuideFormMessages.saveError,
      );
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (dirty && !window.confirm(scoringGuideFormMessages.discard)) return;
    setEditing(false);
    setError("");
    setNotice("");
  }
  return (
    <section className="scoring-guide" aria-label="Guía de reseñas">
      <div className="scoring-heading">
        <h2>Guía de reseñas</h2>
        {saved && !editing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(saved.map((entry) => ({ ...entry })));
              setEditing(true);
              setNotice("");
            }}
          >
            Editar guía
          </button>
        )}
      </div>
      <p className="fine-print">
        Tu referencia personal. No modifica las puntuaciones.
      </p>
      {!saved && !error && <p role="status">Cargando guía…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!saved && error && (
        <button
          type="button"
          className="secondary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Reintentar
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
      {saved && !editing && (
        <dl className="scoring-scale">
          {saved.map((entry) => (
            <div key={entry.score_threshold}>
              <dt>
                {entry.score_threshold}
                <small>/100</small>
              </dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      {editing && (
        <ScoringGuideForm
          draft={draft}
          busy={busy}
          onUpdate={update}
          onRemove={(index) =>
            setDraft((values) => values.filter((_, i) => i !== index))
          }
          onAdd={addScore}
          onReset={restoreDefaultDraft}
          onSave={() => void save()}
          onCancel={cancel}
        />
      )}
    </section>
  );
}
