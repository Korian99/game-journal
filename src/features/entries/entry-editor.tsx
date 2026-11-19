"use client";
import {
  offerTargetChanges,
  type OfferTargetUpdate,
} from "@/features/stores/target-draft";
import { renderDiscardEntryChangesDialog } from "./editor/discard-entry-changes-dialog";
import {
  deleteEntryErrorMessage,
  renderDeleteEntryDialog,
} from "./editor/delete-entry-dialog";
import { renderEntryEditorDialog } from "./editor/entry-editor-dialog";
import {
  EntryEditorForm,
  entryEditorTabs,
  invalidOfferTargetMessage,
} from "./editor/entry-editor-form";
import { renderEntryStartDialog } from "./editor/entry-start-dialog";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/features/stores/store-preview-contract";
import { apiRequest } from "@/lib/api-client";
import {
  restoreStoreCover,
  storeCoverSourcePages,
} from "@/features/stores/restore-store-cover";
import { periodAfterDateEdits } from "@/lib/journal/entry-period";
import { datesAfterStatusChange, defaultNewEntryStatus, statusAfterDateEdits } from "@/lib/journal/entry-status";
import { parseRelease } from "@/lib/releases";
import { upcomingReleaseUpdate } from "@/features/stores/upcoming-release";
import type { JournalView } from "@/lib/journal/journal-location";
import type {
  JournalEntry,
  PerformJournalAction,
} from "@/lib/journal/journal-types";

import type { Offer } from "@/lib/types";
import {
  coverImageUrlSchema,
  coverSchema,
  mergeProviderCover,
} from "@/lib/covers";
import { useEffect, useId, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { ScoringGuideButton } from "@/features/settings/scoring-guide-dialog";

import {
  type PriceHistory,
  type SharingMember,
  type ShareGrant,
} from "@/lib/contracts";

export function EntryEditor({
  entry,
  initialDraft,
  offers,
  members,
  grants,
  busy,
  saving = false,
  onClose,
  onSave,
  onDelete,
  runAction,
  actionError,
  online = true,
  view,
  onReleaseFound,
  embedded = false,
  summaryContent,
  onDirtyChange,
  inlineBlocked = false,
  backRequestRef,
}: {
  entry: JournalEntry;
  initialDraft?: JournalEntry;
  actionError?: string;
  online?: boolean;
  view: JournalView;
  onReleaseFound?: (release: { release: string; year: number }) => Promise<JournalEntry | null>;
  embedded?: boolean;
  summaryContent?: ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
  inlineBlocked?: boolean;
  backRequestRef?: MutableRefObject<(() => void) | null>;
  offers: Offer[];
  members: SharingMember[];
  grants: ShareGrant[];
  busy: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry, targets?: OfferTargetUpdate[]) => Promise<void>;
  onDelete: () => Promise<boolean>;
  runAction: PerformJournalAction;
}) {
  const statusExplicitlyChosen = useRef(initialDraft?.status !== undefined);
  const [draft, setDraft] = useState(() => {
    const initial = { ...entry, ...initialDraft };
    if (!initialDraft?.status && !initial.id && !initial.gameId)
      initial.status = defaultNewEntryStatus(initial);
    return initial;
  });
  const draftRef = useRef(draft);
  const baselineRef = useRef(entry);
  const dateStatusBaseline = useRef(entry);
  // Keep previews separate from manual dates; the server assigns automatic dates on save.
  const displayedStatus = statusAfterDateEdits(draft, dateStatusBaseline.current);
  const displayedDraft = {
    ...draft,
    status: displayedStatus,
    ...datesAfterStatusChange(
      { ...draft, status: displayedStatus },
      entry.id ? entry : undefined,
    ),
  };
  draftRef.current = draft;
  useEffect(() => {
    if (!embedded) return;
    if (JSON.stringify(draftRef.current) === JSON.stringify(baselineRef.current)) {
      baselineRef.current = entry;
      dateStatusBaseline.current = entry;
      setDraft(entry);
    }
  }, [entry, embedded]);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [targetError, setTargetError] = useState("");
  const targetChanges = offerTargetChanges(offers, targetDrafts);
  const setTargetDraft = (id: string, value: string) => {
    setTargetDrafts((current) => ({ ...current, [id]: value }));
    setTargetError("");
  };
  async function saveDraft(candidate: JournalEntry) {
    if (busy || saving || coverRestoreBusy) return;
    if (targetChanges.invalidOfferId) {
      setTargetError(invalidOfferTargetMessage);
      setActiveTab("main");
      requestAnimationFrame(() =>
        document
          .getElementById(targetChanges.invalidOfferId + "-target")
          ?.focus(),
      );
      return;
    }
    setTargetError("");
    await onSave(candidate, targetChanges.updates);
  }
  const [step, setStep] = useState<"choose" | "page" | "search" | "editor">(
    entry.id || entry.gameId ? "editor" : "choose",
  );
  const [storePreview, setStorePreview] = useState<StorePreview | null>(null);
  const [coverRestoreBusy, setCoverRestoreBusy] = useState(false);
  const [coverRestoreError, setCoverRestoreError] = useState("");
  const [coverRestoreStatus, setCoverRestoreStatus] = useState("");
  async function resetCover() {
    setCoverRestoreError("");
    setCoverRestoreStatus("");
    const current = draft.cover;
    if (current?.overrideUrl && current.providerUrl) {
      updateDraftField("cover", {
        providerUrl: current.providerUrl,
        ...(current.provider ? { provider: current.provider } : {}),
      });
      setCoverRestoreStatus(
        "Portada de tienda restablecida. Guardá la entrada para conservar el cambio.",
      );
      return;
    }
    if (current?.providerUrl) {
      setCoverRestoreStatus("La portada ya es la de la tienda.");
      return;
    }
    if (!storeCoverSourcePages(draft.pages ?? []).length) {
      setCoverRestoreError(
        "No hay una página de tienda guardada. Agregá un enlace compatible para recuperar la portada.",
      );
      return;
    }
    setCoverRestoreBusy(true);
    try {
      const restored = await restoreStoreCover(
        current,
        draft.pages ?? [],
        (url) =>
          apiRequest("/api/store-preview", "POST", { url }, storePreviewSchema),
      );
      if (restored?.providerUrl && restored !== current) {
        updateDraftField("cover", restored);
        setCoverRestoreStatus(
          "Portada de tienda restablecida. Guardá la entrada para conservar el cambio.",
        );
      } else {
        setCoverRestoreError(
          "No se encontró una portada de tienda en las páginas guardadas. Revisá el enlace o agregá otro.",
        );
      }
    } finally {
      setCoverRestoreBusy(false);
    }
  }
  function applyStorePreview(
    preview: StorePreview,
    { replaceProviderCover = false }: { replaceProviderCover?: boolean } = {},
  ) {
    setDraft((current) => {
      const platforms = [
        ...new Set(
          [current.platforms, preview.fields.platforms ?? ""]
            .flatMap((value) => value.split(/[;,]/))
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ].join("; ");
      const currentIsValid = coverSchema.safeParse(current.cover).success;
      const currentProvider = coverSchema.safeParse({
        providerUrl: current.cover?.providerUrl,
        provider: current.cover?.provider,
      });
      const coverBase = mergeProviderCover(
        replaceProviderCover
          ? undefined
          : currentIsValid
            ? current.cover
            : currentProvider.success
              ? currentProvider.data
              : undefined,
        preview.cover,
      );
      const rawOverride = current.cover?.overrideUrl;
      const preserveOverride =
        rawOverride !== undefined &&
        (replaceProviderCover ||
          !coverImageUrlSchema.safeParse(rawOverride).success);
      const cover = preserveOverride
        ? { ...(coverBase ?? {}), overrideUrl: rawOverride }
        : coverBase;
      const next = {
        ...current,
        ...preview.fields,
        ...(cover ? { cover } : {}),
        platforms,
        pages: [
          ...new Set([
            ...(current.pages ?? []),
            preview.url,
            ...(preview.additionalPages ?? []),
          ]),
        ],
      };
      if (!statusExplicitlyChosen.current && !next.id && !next.gameId)
        next.status = defaultNewEntryStatus(
          next,
          new Date(),
          preview.quote.status === "upcoming",
        );
      return next;
    });
    setStorePreview(preview);
    setPageUrl("");
    setPageError("");
    setReleaseError("");
    setReleaseSaveError("");
    setActiveTab("main");
    setStep("editor");
    const releaseUpdate = upcomingReleaseUpdate(
      view,
      entry.status,
      preview.fields.release,
    );
    if (step === "search" && entry.id && releaseUpdate && onReleaseFound) {
      void onReleaseFound(releaseUpdate).then((saved) => {
        if (saved) {
          setDraft((current) => ({
            ...current,
            release: saved.release,
            year: saved.year,
            updated_at: saved.updated_at,
          }));
        } else {
          setReleaseSaveError("No se pudo guardar la fecha de Próximos.");
        }
      }).catch(() => {
        setReleaseSaveError("No se pudo guardar la fecha de Próximos.");
      });
    }
  }
  const [pageUrl, setPageUrl] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [activeTab, setActiveTab] = useState(embedded ? "summary" : "main");
  const tabSwipe = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressSwipeClick = useRef(false);
  const [pageError, setPageError] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [releaseSaveError, setReleaseSaveError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(entry) ||
    !!pageUrl.trim() ||
    targetChanges.updates.length > 0 ||
    !!targetChanges.invalidOfferId;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  function requestClose() {
    if (busy || saving || inlineBlocked) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }
  useEffect(() => {
    if (!backRequestRef) return;
    backRequestRef.current = requestClose;
    return () => {
      if (backRequestRef.current === requestClose) backRequestRef.current = null;
    };
  });
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const editorId = useId();
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const deleting = useRef(false);
  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
    else if (wasConfirming.current)
      document.getElementById(editorId + "-options")?.focus();
    wasConfirming.current = confirmDelete;
  }, [confirmDelete, editorId]);
  async function deleteEntry() {
    if (busy || deleting.current) return;
    deleting.current = true;
    setDeleteError("");
    try {
      if (!(await onDelete())) setDeleteError(deleteEntryErrorMessage);
    } catch {
      setDeleteError(deleteEntryErrorMessage);
    } finally {
      deleting.current = false;
    }
  }
  const tabs = entryEditorTabs(embedded);
  function selectTab(id: string) {
    if (inlineBlocked || busy || saving || (embedded && dirty && id === "summary"))
      return;
    setActiveTab(id);
  }
  const updateDraftField = (key: keyof JournalEntry, value: unknown) => {
    if (key === "status") {
      statusExplicitlyChosen.current = true;
      dateStatusBaseline.current = draft;
    }
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "started" || key === "finished")
        next.period = periodAfterDateEdits(next, current);
      if (key === "release") {
        const parsed = parseRelease(String(value ?? ""));
        next.year = "year" in parsed ? parsed.year : null;
        if (!statusExplicitlyChosen.current && !next.id && !next.gameId)
          next.status = defaultNewEntryStatus(
            next,
            new Date(),
            storePreview?.quote.status === "upcoming",
          );
      }
      return next;
    });
  };
  // Keep the same Modal instance across dialog steps and confirmations.
  if (confirmDiscard)
    return renderDiscardEntryChangesDialog({
      onKeepEditing: () => setConfirmDiscard(false),
      onDiscard: onClose,
    });
  if (confirmDelete && entry.id)
    return renderDeleteEntryDialog({
      entry,
      dirty,
      busy,
      error: deleteError,
      cancelButtonRef: cancelDelete,
      onCancel: () => setConfirmDelete(false),
      onConfirm: deleteEntry,
    });
  if (step !== "editor")
    return renderEntryStartDialog({
      entryTitle: entry.title,
      onClose: requestClose,
      step,
      editing: !!entry.id,
      online,
      url: pageUrl,
      setUrl: setPageUrl,
      onManual: () => setStep("editor"),
      onLoaded: applyStorePreview,
      initialQuery: draft.title,
      initialUrl:
        draft.pages?.find((url) => url.toLowerCase().includes("nintendo")) ??
        draft.pages?.[0],
    });
  const editorBody = (
    <EntryEditorForm
      editorId={editorId}
      tabs={tabs}
      embedded={embedded}
      summaryContent={summaryContent}
      inlineBlocked={inlineBlocked}
      saving={saving}
      actionError={actionError}
      targetError={targetError}
      rawPlayDates={{ started: draft.started, finished: draft.finished }}
      fields={{
        entry,
        draft: displayedDraft,
        online,
        dirty,
        busy,
        activeTab,
        updateDraftField,
        offers,
        targetDrafts,
        setTargetDraft,
        runAction,
        priceHistory,
        setPriceHistory,
        pageUrl,
        setPageUrl,
        pageError,
        setPageError,
        members,
        grants,
        recipientId,
        setRecipientId,
        onSave: saveDraft,
        releaseError,
        setReleaseError,
      }}
      cover={{
        restoring: coverRestoreBusy,
        restoreError: coverRestoreError,
        restoreStatus: coverRestoreStatus,
        onRestore: () => void resetCover(),
      }}
      lookup={{
        storePreview,
        releaseSaveError,
        onLookupPage: () => setStep("page"),
        onLookupSearch: () => setStep("search"),
      }}
      onSelectTab={selectTab}
      onValidationTab={setActiveTab}
    />
  );
  if (embedded)
    return (
      <section
        className="notebook-book-editor"
        aria-label="Datos del juego"
        onPointerDown={(event) => {
          suppressSwipeClick.current = false;
          if (event.pointerType !== "touch" || !event.isPrimary) { tabSwipe.current = null; return; }
          const target = event.target instanceof Element ? event.target : null;
          if (!target || target.closest("input, textarea, select, a, [contenteditable=true], .inline-editor, button:not(.inline-value), [role=button]")) { tabSwipe.current = null; return; }
          tabSwipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const gesture = tabSwipe.current;
          if (!gesture || gesture.pointerId !== event.pointerId) return;
          const dx = event.clientX - gesture.x;
          const dy = event.clientY - gesture.y;
          tabSwipe.current = null;
          if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
          suppressSwipeClick.current = true;
          const index = tabs.findIndex((tab) => tab.id === activeTab);
          const next = tabs[index + (dx < 0 ? 1 : -1)];
          if (!next) return;
          selectTab(next.id);
        }}
        onPointerCancel={() => { tabSwipe.current = null; }}
        onLostPointerCapture={() => { tabSwipe.current = null; }}
        onClickCapture={(event) => {
          if (!suppressSwipeClick.current || event.detail === 0) return;
          suppressSwipeClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div className="notebook-book-header">
          <button type="button" className="library-notebook-back" onClick={requestClose} disabled={busy || saving}>← Biblioteca</button>
          <ScoringGuideButton />
        </div>
        {editorBody}
      </section>
    );
  return renderEntryEditorDialog({
    editing: !!entry.id,
    saving,
    optionsId: editorId + "-options",
    deleteDisabled: busy || !online,
    onClose: requestClose,
    onDeleteRequest: () => {
      setDeleteError("");
      setConfirmDelete(true);
    },
    children: editorBody,
  });
}
