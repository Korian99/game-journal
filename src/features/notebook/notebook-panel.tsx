"use client";

import { apiRequest } from "@/lib/api-client";
import { notebookSchema } from "./notebook";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/dialog";
import type { JournalEntry } from "@/lib/journal/journal-types";

export function Notebook({
  records,
  onAppendToGame,
}: {
  records: JournalEntry[];
  onAppendToGame: (id: string, text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"notebook" | "game" | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [gameId, setGameId] = useState("");
  const draft = useRef(false);
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const playing = records.filter(
    (record) => record.status === "playing" && record.id && record.updated_at,
  );
  const game = playing.find((record) => record.id === gameId);
  const disabled = loading || saving !== null || loadError || !loaded;

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(""), 1800);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function load() {
    if (draft.current || loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setLoadError(false);
    setError("");
    setSaved("");
    try {
      const result = await apiRequest(
        "/api/notebook",
        "GET",
        undefined,
        notebookSchema,
      );
      setContent(result.content);
      setLoaded(true);
    } catch (failure) {
      setLoadError(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo cargar el cuaderno. Volvé a intentarlo.",
      );
    } finally {
      loadInFlight.current = false;
      setLoading(false);
    }
  }

  function openNotebook() {
    setGameId("");
    setOpen(true);
    if (!draft.current) void load();
  }

  async function save() {
    if (saveInFlight.current || !loaded || loadError) return;
    saveInFlight.current = true;
    setSaving("notebook");
    setSaved("");
    setError("");
    const submitted = content;
    try {
      const result = await apiRequest(
        "/api/notebook",
        "PUT",
        { content: submitted },
        notebookSchema,
      );
      setContent(result.content);
      draft.current = false;
      setLoaded(true);
      setSaved("Guardado");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar el cuaderno. Volvé a intentarlo.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(null);
    }
  }

  async function addToGame() {
    if (saveInFlight.current || disabled || !game?.id || !content.trim()) return;
    saveInFlight.current = true;
    setSaving("game");
    setSaved("");
    setError("");
    try {
      await onAppendToGame(game.id, content);
      setGameId("");
      setSaved(`Nota agregada al recordatorio de ${game.title}.`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo agregar la nota al juego. Volvé a intentarlo.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(null);
    }
  }

  return (
    <>
      <button
        className="notification-count notebook-trigger"
        aria-label="Abrir cuaderno"
        title="Cuaderno"
        onClick={openNotebook}
      >
        <BookOpen size={17} aria-hidden="true" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cuaderno"
        closeDisabled={saving !== null}
      >
        <div className="modal-body notebook-modal-body">
          <label className="notebook-notes-label" htmlFor="notebook-notes">
            Notas
          </label>
          <textarea
            id="notebook-notes"
            aria-label="Notas"
            maxLength={100000}
            value={content}
            disabled={disabled}
            onChange={(event) => {
              draft.current = true;
              setContent(event.target.value);
              setError("");
              setSaved("");
            }}
          />
          <div className="notebook-game-note">
            <label className="notebook-notes-label" htmlFor="notebook-game">
              Juego en curso
            </label>
            <p className="notebook-message" id="notebook-game-description">
              {playing.length
                ? "Agregá todo este texto al recordatorio privado del juego."
                : "Acá aparecen los juegos marcados como Jugando."}
            </p>
            <div className="notebook-game-controls">
              <select
                id="notebook-game"
                aria-describedby="notebook-game-description"
                disabled={disabled || !playing.length}
                value={game?.id ?? ""}
                onChange={(event) => {
                  setGameId(event.target.value);
                  setError("");
                  setSaved("");
                }}
              >
                <option value="">Elegí un juego</option>
                {playing.map((record) => (
                  <option key={record.id} value={record.id}>
                    {[record.title, record.device, record.period]
                      .filter(Boolean)
                      .join(" · ")}
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                disabled={disabled || !game || !content.trim()}
                onClick={() => void addToGame()}
              >
                {saving === "game" ? "Agregando…" : "Agregar al recordatorio"}
              </button>
            </div>
          </div>
          {error && (
            <p className="notebook-message" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="notebook-message notebook-saved" role="status">
              {saved}
            </p>
          )}
          {loadError && (
            <button className="secondary" onClick={() => void load()}>
              Reintentar carga
            </button>
          )}
          <div className="notebook-save-row">
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void save()}
            >
              {saving === "notebook" ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
