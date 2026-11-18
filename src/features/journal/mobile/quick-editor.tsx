"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/dialog";
import {
  quickDraft,
  quickFields,
  quickUnchanged,
  type QuickFields,
} from "@/lib/journal/quick-editing";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { QuickEditorDiscardConfirmation } from "./quick-editor-discard-confirmation";
import { QuickEditorForm, quickEditorFormMessages } from "./quick-editor-form";

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
  const [transitioningTo, setTransitioningTo] = useState<"playing" | "completed" | "">("");
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
  const canStart = ["wishlist", "upcoming", "backlog", "paused", "abandoned"].includes(
    entry.status,
  );
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
        failure instanceof Error
          ? failure.message
          : quickEditorFormMessages.saveError,
      );
    } finally {
      inFlight.current = false;
    }
  }
  async function saveStatusTransition(status: "playing" | "completed") {
    if (!online || saving || inFlight.current || transitioningTo) return;
    setError("");
    setTransitioningTo(status);
    inFlight.current = true;
    try {
      const draft = quickDraft(entry, { ...fields, status });
      if (await onSave(entry, draft)) onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : quickEditorFormMessages.saveError,
      );
    } finally {
      inFlight.current = false;
      setTransitioningTo("");
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
        failure instanceof Error
          ? failure.message
          : quickEditorFormMessages.validationError,
      );
    }
  }
  return (
    <Modal
      open
      title="Edición rápida"
      variant="sheet"
      onClose={requestClose}
      closeDisabled={saving || !!transitioningTo}
      onEscapeKeyDown={(event) => {
        if (saving || inFlight.current) event.preventDefault();
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
          <QuickEditorDiscardConfirmation
            keepEditingRef={keepEditing}
            onKeepEditing={() => setConfirmDiscard(false)}
            onDiscard={onClose}
          />
        ) : (
          <QuickEditorForm
            entryStatus={entry.status}
            fields={fields}
            played={played}
            canStart={canStart}
            online={online}
            saving={saving}
            dirty={dirty}
            transitioningTo={transitioningTo}
            error={error || actionError}
            onFieldChange={update}
            onStatusTransition={(status) => void saveStatusTransition(status)}
            onSave={() => void save()}
            onFull={full}
            onCancel={requestClose}
          />
        )}
      </div>
    </Modal>
  );
}
