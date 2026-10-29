"use client";

import { apiRequest } from "@/lib/api-client";
import { notebookSchema } from "@/lib/notebook";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/dialog";

export function Notebook() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const draft = useRef(false);
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function load() {
    if (draft.current || loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setLoadError(false);
    setError("");
    setSaved(false);
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
    setOpen(true);
    if (!draft.current) void load();
  }

  async function save() {
    if (saveInFlight.current || !loaded || loadError) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaved(false);
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
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar el cuaderno. Volvé a intentarlo.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
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
        closeDisabled={saving}
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
            disabled={loading || saving || loadError || !loaded}
            onChange={(event) => {
              draft.current = true;
              setContent(event.target.value);
              setError("");
              setSaved(false);
            }}
          />
          {error && (
            <p className="notebook-message" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="notebook-message notebook-saved" role="status">
              Guardado
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
              disabled={loading || saving || loadError || !loaded}
              onClick={() => void save()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
