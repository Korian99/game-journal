"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import {
  defaultScoringGuide,
  scoringGuideSchema,
  type ScoringEntry,
} from "@/lib/scoring-guide";
import { Modal } from "../ui/dialog";

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
        error instanceof Error ? error.message : "No se pudo guardar la guía.",
      );
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (dirty && !window.confirm("¿Descartar los cambios de la guía?")) return;
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
        <>
          <div className="scoring-rows">
            {draft.map((entry, index) => (
              <div className="scoring-edit-row" key={index}>
                <label>
                  Puntaje
                  <input
                    aria-label={"Puntaje " + (index + 1)}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={
                      Number.isNaN(entry.score_threshold)
                        ? ""
                        : entry.score_threshold
                    }
                    disabled={busy}
                    onChange={(event) =>
                      update(index, {
                        score_threshold:
                          event.target.value === ""
                            ? NaN
                            : event.target.valueAsNumber,
                      })
                    }
                  />
                </label>
                <label>
                  Significado
                  <textarea
                    aria-label={"Significado " + (index + 1)}
                    rows={3}
                    maxLength={2000}
                    value={entry.meaning}
                    disabled={busy}
                    onChange={(event) =>
                      update(index, { meaning: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  aria-label={"Quitar puntaje " + (index + 1)}
                  disabled={busy || draft.length === 1}
                  onClick={() =>
                    setDraft((values) => values.filter((_, i) => i !== index))
                  }
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={busy || draft.length >= 101}
              onClick={() => {
                const score = Array.from(
                  { length: 101 },
                  (_, i) => 100 - i,
                ).find(
                  (score) =>
                    !draft.some((entry) => entry.score_threshold === score),
                );
                if (score !== undefined)
                  setDraft((values) => [
                    ...values,
                    { score_threshold: score, meaning: "" },
                  ]);
              }}
            >
              Añadir puntaje
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "¿Reemplazar el borrador por la guía inicial? Podés revisarlo antes de guardar.",
                  )
                )
                  setDraft(defaultScoringGuide.map((entry) => ({ ...entry })));
              }}
            >
              Usar guía inicial
            </button>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "Guardando…" : "Guardar guía"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={cancel}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ScoringGuideButton() {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  function close() {
    if (!dirty || window.confirm("¿Descartar los cambios de la guía?")) {
      setOpen(false);
      setDirty(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-button"
        onClick={() => setOpen(true)}
      >
        Guía de reseñas
      </button>
      {open && (
        <Modal open onClose={close} title="Guía de reseñas">
          <ScoringGuide onDirtyChange={setDirty} />
        </Modal>
      )}
    </>
  );
}
