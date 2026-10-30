"use client";
import { PlayDateInput } from "./play-date-input";
import {
  offerTargetChanges,
  type OfferTargetUpdate,
} from "@/lib/offers/target-draft";
import { EntrySaveStatus } from "./entry-save-status";
import { EntryStart } from "./editor/entry-start";
import { StorePreviewCard } from "./editor/store-preview-card";
import type { StorePreview } from "@/lib/offers/store-preview-contract";
import { MainTab } from "./editor/main-tab";
import { PlaythroughTab } from "./editor/playthrough-tab";
import { ReviewTab } from "./editor/review-tab";
import { MoreTab } from "./editor/more-tab";

import { periodAfterDateEdits } from "@/lib/journal/entry-period";
import {
  defaultNewEntryStatus,
  statusAfterDateEdits,
} from "@/lib/journal/entry-status";
import { parseRelease } from "@/lib/releases";
import type {
  JournalEntry,
  PerformJournalAction,
} from "@/lib/journal/journal-types";

import { statuses, type Offer } from "@/lib/types";
import { pagesSchema, releaseSchema } from "@/lib/validation";
import { formatDate } from "@/lib/journal/view-config";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { EntryActionsMenu } from "./entry-actions-menu";

import { Modal } from "../ui/dialog";
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
}: {
  entry: JournalEntry;
  initialDraft?: JournalEntry;
  actionError?: string;
  online?: boolean;
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
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [targetError, setTargetError] = useState("");
  const targetChanges = offerTargetChanges(offers, targetDrafts);
  const setTargetDraft = (id: string, value: string) => {
    setTargetDrafts((current) => ({ ...current, [id]: value }));
    setTargetError("");
  };
  async function saveDraft(candidate: JournalEntry) {
    if (busy || saving) return;
    if (targetChanges.invalidOfferId) {
      setTargetError(
        "Revisá el Objetivo: usá un precio igual o mayor que cero.",
      );
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
  const [step, setStep] = useState<"choose" | "page" | "editor">(
    entry.id || entry.gameId ? "editor" : "choose",
  );
  const [storePreview, setStorePreview] = useState<StorePreview | null>(null);
  function applyStorePreview(preview: StorePreview) {
    setDraft((current) => {
      const platforms = [
        ...new Set(
          [current.platforms, preview.fields.platforms ?? ""]
            .flatMap((value) => value.split(/[;,]/))
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ].join("; ");
      const next = {
        ...current,
        ...preview.fields,
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
    setActiveTab("main");
    setStep("editor");
  }
  const [pageUrl, setPageUrl] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [activeTab, setActiveTab] = useState("main");
  const [pageError, setPageError] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(entry) ||
    !!pageUrl.trim() ||
    targetChanges.updates.length > 0 ||
    !!targetChanges.invalidOfferId;
  function requestClose() {
    if (busy || saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }
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
      if (!(await onDelete()))
        setDeleteError(
          "No se pudo eliminar la entrada. Podés volver a intentarlo.",
        );
    } catch {
      setDeleteError(
        "No se pudo eliminar la entrada. Podés volver a intentarlo.",
      );
    } finally {
      deleting.current = false;
    }
  }
  const formId = editorId + "-form";
  const tabs = [
    { id: "main", label: "Principal" },
    { id: "playthrough", label: "Partida" },
    { id: "review", label: "Reseña" },
    { id: "more", label: "Más" },
  ];
  const updateDraftField = (key: keyof JournalEntry, value: unknown) => {
    if (key === "status") statusExplicitlyChosen.current = true;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "started" || key === "finished")
        next.period = periodAfterDateEdits(next, current);
      if (key === "release") {
        const parsed = parseRelease(String(value ?? ""));
        next.year = parsed.kind === "unknown" ? null : parsed.year;
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
  const renderField = (
    key: keyof JournalEntry,
    label: string,
    type = "text",
  ) => (
    <label key={key}>
      {label}
      {key === "started" || key === "finished" ? (
        <PlayDateInput
          id={editorId + "-" + key}
          form={formId}
          value={String(draft[key] ?? "")}
          placeholder="dd/mm/aa o dd/mm/aaaa"
          onChange={(value) => updateDraftField(key, value)}
        />
      ) : (
        <input
          id={editorId + "-" + key}
          form={formId}
          type={type}
          required={key === "title"}
          value={String(draft[key] ?? "")}
          onChange={(event) =>
            updateDraftField(
              key,
              type === "number"
                ? event.target.value === ""
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          step={type === "number" ? "any" : undefined}
        />
      )}
    </label>
  );
  if (confirmDiscard)
    return (
      <Modal
        open
        title="Descartar cambios"
        onClose={() => setConfirmDiscard(false)}
      >
        <div className="modal-body">
          <p>Tenés cambios sin guardar.</p>
          <div className="button-row">
            <button
              className="secondary"
              autoFocus
              onClick={() => setConfirmDiscard(false)}
            >
              Seguir editando
            </button>
            <button className="danger" onClick={onClose}>
              Descartar cambios
            </button>
          </div>
        </div>
      </Modal>
    );
  if (confirmDelete && entry.id)
    return (
      <Modal
        open
        title="Eliminar entrada"
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
      >
        <div className="modal-body delete-entry-confirmation">
          <p>
            ¿Querés eliminar esta entrada de <strong>{entry.title}</strong>?
          </p>
          <p className="muted delete-entry-context">
            {[
              statuses[entry.status],
              entry.device,
              entry.started ? "Empecé: " + formatDate(entry.started) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="fine-print">
            Las demás partidas de este juego se conservan. Podés restaurarla
            desde Papelera durante 30 días.
          </p>
          {dirty && (
            <p className="error">
              Los cambios sin guardar de este formulario se descartarán al
              eliminar la entrada.
            </p>
          )}
          {deleteError && (
            <p className="delete-entry-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="delete-entry-buttons">
            <button
              ref={cancelDelete}
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger delete-entry-confirm"
              disabled={busy}
              onClick={deleteEntry}
            >
              <Trash2 size={16} />
              {busy ? "Eliminando…" : "Confirmar eliminación"}
            </button>
          </div>
        </div>
      </Modal>
    );
  if (step !== "editor")
    return (
      <Modal
        open
        onClose={requestClose}
        title={
          step === "choose"
            ? "¿Cómo querés cargar el juego?"
            : entry.id
              ? "Actualizar datos de " + entry.title
              : "Completar desde una página"
        }
      >
        <EntryStart
          step={step}
          editing={!!entry.id}
          online={online}
          url={pageUrl}
          setUrl={setPageUrl}
          onManual={() => setStep("editor")}
          onLoaded={applyStorePreview}
        />
      </Modal>
    );
  return (
    <Modal
      open
      onClose={requestClose}
      title={entry.id ? "Tu partida" : "Agregar un juego"}
      headerStatus={saving ? <EntrySaveStatus /> : undefined}
      onEscapeKeyDown={(event) => {
        const trigger = document.getElementById(editorId + "-options");
        const menu = trigger?.closest("details");
        if (menu?.open) {
          event.preventDefault();
          menu.open = false;
          trigger?.focus();
        }
      }}
      headerActions={
        entry.id ? (
          <EntryActionsMenu
            triggerId={editorId + "-options"}
            busy={busy || !online}
            onDeleteRequest={() => {
              setDeleteError("");
              setConfirmDelete(true);
            }}
          />
        ) : undefined
      }
    >
      <div className="modal-body entry-editor">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || saving) return;
            if (!draft.title.trim()) {
              setActiveTab("main");
              requestAnimationFrame(() => {
                const name = document.getElementById(
                  editorId + "-title",
                ) as HTMLInputElement | null;
                name?.focus();
                name?.reportValidity();
              });
              return;
            }
            const release = releaseSchema.safeParse(draft.release ?? "");
            if (!release.success) {
              setReleaseError(release.error.issues[0].message);
              setActiveTab("more");
              return;
            }
            setReleaseError("");
            const pages = pagesSchema.safeParse([
              ...(draft.pages ?? []),
              ...(pageUrl.trim() ? [pageUrl] : []),
            ]);
            if (!pages.success) {
              setPageError(
                pages.error.issues[0]?.message ?? "Revisá las páginas.",
              );
              setActiveTab("main");
              return;
            }
            setPageError("");
            void saveDraft({
              ...draft,
              pages: pages.data,
              status: statusAfterDateEdits(draft, entry),
            });
          }}
        />
        <fieldset
          className="entry-editor-fields"
          disabled={saving}
          aria-busy={saving}
        >
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Secciones del juego"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const index = tabs.findIndex((tab) => tab.id === activeTab);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              setActiveTab(tabs[next].id);
              document
                .getElementById(editorId + "-tab-" + tabs[next].id)
                ?.focus();
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={editorId + "-tab-" + tab.id}
                aria-controls={editorId + "-panel-" + tab.id}
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-main"}
            aria-labelledby={editorId + "-tab-main"}
            hidden={activeTab !== "main"}
          >
            {activeTab === "main" && (
              <button
                type="button"
                className="text-button editor-store-lookup"
                disabled={busy || !online}
                onClick={() => setStep("page")}
              >
                Completar desde una página
              </button>
            )}
            {activeTab === "main" &&
              storePreview &&
              draft.pages?.includes(storePreview.url) && (
                <StorePreviewCard preview={storePreview} />
              )}
            <MainTab
              online={online}
              draft={draft}
              updateDraftField={updateDraftField}
              renderField={renderField}
              formId={formId}
              offers={offers}
              targetDrafts={targetDrafts}
              setTargetDraft={setTargetDraft}
              runAction={runAction}
              priceHistory={priceHistory}
              setPriceHistory={setPriceHistory}
              pageUrl={pageUrl}
              setPageUrl={setPageUrl}
              pageError={pageError}
              setPageError={setPageError}
              busy={busy}
              activeTab={activeTab}
            />
          </section>
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-playthrough"}
            aria-labelledby={editorId + "-tab-playthrough"}
            hidden={activeTab !== "playthrough"}
          >
            <PlaythroughTab
              draft={draft}
              updateDraftField={updateDraftField}
              renderField={renderField}
              formId={formId}
              activeTab={activeTab}
            />
          </section>
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-review"}
            aria-labelledby={editorId + "-tab-review"}
            hidden={activeTab !== "review"}
          >
            <ReviewTab
              draft={draft}
              updateDraftField={updateDraftField}
              renderField={renderField}
              formId={formId}
              activeTab={activeTab}
            />
          </section>
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-more"}
            aria-labelledby={editorId + "-tab-more"}
            hidden={activeTab !== "more"}
          >
            <MoreTab
              online={online}
              dirty={dirty}
              entry={entry}
              draft={draft}
              updateDraftField={updateDraftField}
              renderField={renderField}
              formId={formId}
              runAction={runAction}
              members={members}
              grants={grants}
              recipientId={recipientId}
              setRecipientId={setRecipientId}
              busy={busy}
              onSave={saveDraft}
              releaseError={releaseError}
              setReleaseError={setReleaseError}
              activeTab={activeTab}
            />
          </section>
        </fieldset>
        {!online && (
          <p className="fine-print">
            Necesitás conexión para guardar. El formulario se conserva mientras
            siga abierto.
          </p>
        )}
        {(targetError || actionError) && (
          <p className="error" role="alert">
            {targetError || actionError}
          </p>
        )}
        <div className="entry-editor-actions">
          <button
            type="button"
            className="text-button"
            onClick={requestClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy}
          >
            {saving ? "Guardando…" : "Guardar entrada"}
            {saving ? (
              <LoaderCircle
                size={16}
                className="save-spinner"
                aria-hidden="true"
              />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
