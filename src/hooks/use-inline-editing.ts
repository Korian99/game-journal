"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api-client";
import { saveResponseSchema } from "../lib/contracts";
import {
  inlineCandidate,
  inlineUnchanged,
  inlineValue,
  inlineChange,
  undoCandidate,
  inlineFields,
  type InlineChange,
  type InlineFieldName,
} from "../lib/journal/inline-editing";
import type { JournalEntry } from "../lib/journal/journal-types";
import type { JournalView } from "../lib/journal/journal-location";
import { recordSchema } from "../lib/validation";
export function useInlineEditing({
  records,
  online,
  blocked,
  acceptRecord,
}: {
  records: JournalEntry[];
  online: boolean;
  blocked: boolean;
  acceptRecord: (entry: JournalEntry) => void;
}) {
  const [active, setActive] = useState<{
    entry: JournalEntry;
    field: InlineFieldName;
    value: string;
    view: JournalView;
    slot: string;
  } | null>(null);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [history, setHistory] = useState<InlineChange[]>([]);
  const inFlight = useRef(false);
  const canEdit = online && !blocked && !saving;
  const dirty =
    !!active && !inlineUnchanged(active.entry, active.field, active.value);
  function begin(
    entry: JournalEntry,
    field: InlineFieldName,
    view: JournalView,
    slot = "value",
  ) {
    if (!canEdit || !entry.id) return;
    if (active && dirty) {
      setError("Guardá o cancelá la celda que estás editando.");
      return;
    }
    const value = inlineValue(entry, field);
    setError("");
    setMessage("");
    setActive({ entry: { ...entry }, field, value, view, slot });
  }
  function cancel() {
    if (inFlight.current) return;
    setActive(null);
    setError("");
  }
  async function persist(candidate: JournalEntry, undo = false) {
    if (!candidate.id || !candidate.updated_at)
      throw Error("Actualizá los datos antes de editar esta entrada.");
    const response = await apiRequest(
      "/api/records",
      "POST",
      { ...recordSchema.parse(candidate), ...(undo ? { intent: "undo" } : {}) },
      saveResponseSchema,
    );
    if (
      !response.record ||
      response.record.id !== candidate.id ||
      !response.record.updated_at
    )
      throw Error(
        "No se pudo confirmar la versión guardada. Actualizá los datos antes de reintentar.",
      );
    acceptRecord(response.record);
    return response.record;
  }
  async function saveDraft(
    base: JournalEntry,
    candidate: JournalEntry,
    label: string,
  ): Promise<JournalEntry | null> {
    if (inFlight.current || !online || blocked) return null;
    setError("");
    try {
      const current = records.find((record) => record.id === base.id);
      if (!current)
        throw Error(
          "La entrada ya no está disponible. No se guardó ningún cambio.",
        );
      if (
        candidate.id !== base.id ||
        candidate.gameId !== base.gameId ||
        current.updated_at !== base.updated_at ||
        JSON.stringify(recordSchema.parse(current)) !==
          JSON.stringify(recordSchema.parse(base))
      )
        throw Error(
          "La entrada cambió. Cancelá y volvé a editar con los datos actuales.",
        );
      if (
        JSON.stringify(recordSchema.parse(candidate)) ===
        JSON.stringify(recordSchema.parse(base))
      )
        return current;
      inFlight.current = true;
      setSaving(true);
      const saved = await persist(candidate);
      setHistory((previous) =>
        [...previous, inlineChange(base, saved, label)].slice(-50),
      );
      setMessage("Guardado: " + label);
      return saved;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "No se pudo guardar.",
      );
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  async function save() {
    if (!active || inFlight.current || !online || blocked) return false;
    if (!dirty) {
      cancel();
      return true;
    }
    try {
      const candidate = inlineCandidate(
        active.entry,
        active.field,
        active.value,
      );
      const saved = await saveDraft(
        active.entry,
        candidate,
        inlineFields[active.field].label,
      );
      if (saved) {
        setActive(null);
        return true;
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "No se pudo guardar.",
      );
    }
    return false;
  }
  async function undo() {
    const change = history.at(-1);
    if (!change || active || inFlight.current || !online || blocked) return;
    setError("");
    try {
      const current = records.find((record) => record.id === change.id);
      if (!current)
        throw Error(
          "La entrada ya no está disponible. No se deshizo ningún cambio.",
        );
      const candidate = undoCandidate(current, change);
      inFlight.current = true;
      setSaving(true);
      await persist(candidate, true);
      setHistory((previous) => previous.slice(0, -1));
      setMessage("Cambio deshecho");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "No se pudo deshacer.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        !active ||
        dirty ||
        inFlight.current ||
        !(event.target instanceof Element) ||
        event.target.closest(
          ".inline-editor, .inline-value, .inline-details, .inline-edit-bar",
        )
      )
        return;
      setActive(null);
      setError("");
    };
    document.addEventListener("pointerdown", outside, true);
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "z" ||
        (target instanceof HTMLElement &&
          (target.closest(
            "input,textarea,select,[contenteditable=true],[role=dialog]",
          ) ||
            document.querySelector("[role=dialog]")))
      )
        return;
      if (history.length && !active && canEdit) {
        event.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", key);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  });
  return {
    active,
    saving,
    error,
    message,
    history,
    canEdit,
    dirty,
    begin,
    cancel,
    save,
    saveDraft,
    undo,
    setValue: (value: string) => {
      setActive((current) => (current ? { ...current, value } : null));
      setError("");
    },
  };
}
export type InlineEditing = ReturnType<typeof useInlineEditing>;
