"use client";

import { apiRequest } from "@/lib/api-client";
import { notebookSchema } from "./notebook";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/dialog";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { NotebookForm, notebookFormMessages } from "./notebook-form";
import { notebookReminderMessages } from "./notebook-game-reminder-picker";

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
          : notebookFormMessages.loadError,
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
      setSaved(notebookFormMessages.saved);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : notebookFormMessages.saveError,
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
      setSaved(notebookReminderMessages.saved(game.title));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : notebookReminderMessages.saveError,
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
        <NotebookForm
          content={content}
          disabled={disabled}
          saving={saving === "notebook"}
          loadError={loadError}
          error={error}
          saved={saved}
          onContentChange={(value) => {
            draft.current = true;
            setContent(value);
            setError("");
            setSaved("");
          }}
          onRetry={() => void load()}
          onSave={() => void save()}
          reminder={{
            games: playing,
            selectedId: game?.id ?? "",
            canAppend: !!game && !!content.trim(),
            appending: saving === "game",
            onSelect: (id) => {
              setGameId(id);
              setError("");
              setSaved("");
            },
            onAppend: () => void addToGame(),
          }}
        />
      </Modal>
    </>
  );
}
