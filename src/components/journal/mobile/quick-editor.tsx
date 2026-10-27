"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "../../ui/dialog";
import {
  quickDraft,
  quickFields,
  quickUnchanged,
  type QuickFields,
} from "@/lib/journal/quick-editing";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { statuses } from "@/lib/types";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

export function QuickEditor({
  entry,
  online,
  saving,
  actionError,
  onClose,
  onSave,
  onFull,
  onRestoreFocus,
}: {
  entry: JournalEntry;
  online: boolean;
  saving: boolean;
  actionError: string;
  onClose: () => void;
  onSave: (base: JournalEntry, draft: JournalEntry) => Promise<boolean>;
  onFull: (base: JournalEntry, draft: JournalEntry) => void;
  onRestoreFocus: () => void;
}) {
  const [fields, setFields] = useState(() => quickFields(entry));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState("");
  const intro = useRef<HTMLParagraphElement>(null),
    keepEditing = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false),
    transferring = useRef(false);
  const dirty = !quickUnchanged(entry, fields);
  const played = [
    "playing",
    "completed",
    "paused",
    "abandoned",
    "remembered",
  ].includes(fields.status);
  function requestClose() {
    if (saving || inFlight.current) return false;
    if (dirty) {
      setConfirmDiscard(true);
      return false;
    }
    onClose();
    return true;
  }
  useOverlayHistory(requestClose);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty || saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, saving]);
  useEffect(() => {
    if (confirmDiscard) keepEditing.current?.focus();
  }, [confirmDiscard]);
  function update(key: keyof QuickFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setError("");
  }
  async function save() {
    if (!online || saving || inFlight.current || !dirty) return;
    setError("");
    try {
      const draft = quickDraft(entry, fields);
      inFlight.current = true;
      if (await onSave(entry, draft)) onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "No se pudo guardar.",
      );
    } finally {
      inFlight.current = false;
    }
  }
  function full() {
    if (saving || inFlight.current) return;
    setError("");
    try {
      const draft = dirty ? quickDraft(entry, fields) : { ...entry };
      transferring.current = true;
      onFull(entry, draft);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Revisá los valores.",
      );
    }
  }
  return (
    <Modal
      open
      title="Edición rápida"
      variant="sheet"
      onClose={requestClose}
      closeDisabled={saving}
      onEscapeKeyDown={(event) => {
        if (saving) event.preventDefault();
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        intro.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!transferring.current) onRestoreFocus();
      }}
    >
      <div className="quick-editor-body">
        <p className="quick-editor-title" ref={intro} tabIndex={-1}>
          {entry.title}
        </p>
        {!online && (
          <p className="quick-editor-notice" role="status">
            Necesitás conexión para guardar. Podés consultar los datos.
          </p>
        )}
        {confirmDiscard ? (
          <section className="quick-discard">
            <h3>Descartar cambios</h3>
            <p>Tus cambios todavía no se guardaron.</p>
            <div className="button-row">
              <button
                className="secondary"
                ref={keepEditing}
                onClick={() => setConfirmDiscard(false)}
              >
                Seguir editando
              </button>
              <button className="text-button danger" onClick={onClose}>
                Descartar
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={saving || !online}>
              <label>
                Estado
                <select
                  aria-label="Estado"
                  value={fields.status}
                  onChange={(event) => update("status", event.target.value)}
                >
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {played ? (
                <div className="quick-editor-numbers">
                  <label>
                    Hs. jugadas
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={fields.hours}
                      onChange={(event) => update("hours", event.target.value)}
                    />
                  </label>
                  <label>
                    Reseña / 100
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={fields.rating}
                      onChange={(event) => update("rating", event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <label>
                  Prioridad
                  <input
                    type="text"
                    value={fields.priority}
                    maxLength={100}
                    onChange={(event) => update("priority", event.target.value)}
                  />
                </label>
              )}
            </fieldset>
            {(error || actionError) && (
              <p className="error" role="alert">
                {error || actionError}
              </p>
            )}
            <div className="quick-editor-actions">
              <button
                type="button"
                className="text-button"
                disabled={saving}
                onClick={full}
              >
                Abrir formulario completo
              </button>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={requestClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={saving || !online || !dirty}
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={15} className="save-spinner" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
