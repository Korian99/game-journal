import type { ComponentProps, ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { coverSchema } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { pagesSchema, releaseSchema } from "@/lib/validation";
import { PlayDateInput } from "../play-date-input";
import type { EditorContext } from "./editor-context";
import { MoreTab } from "./more-tab";
import { PlaythroughTab } from "./playthrough-tab";
import { PrincipalPage } from "./principal-page";
import { ReviewTab } from "./review-tab";

export const invalidOfferTargetMessage =
  "Revisá el Objetivo: usá un precio igual o mayor que cero.";

export function entryEditorTabs(embedded: boolean) {
  return [
    ...(embedded ? [{ id: "summary", label: "Resumen" }] : []),
    { id: "main", label: "Principal" },
    ...(!embedded ? [{ id: "playthrough", label: "Partida" }] : []),
    ...(!embedded ? [{ id: "review", label: "Reseña" }] : []),
    { id: "more", label: "Más" },
  ];
}

type PrincipalProps = ComponentProps<typeof PrincipalPage>;

export function EntryEditorForm({
  editorId,
  tabs,
  embedded,
  summaryContent,
  inlineBlocked,
  saving,
  actionError,
  targetError,
  rawPlayDates,
  fields,
  cover,
  lookup,
  onSelectTab,
  onValidationTab,
  onCancel,
}: {
  editorId: string;
  tabs: ReturnType<typeof entryEditorTabs>;
  embedded: boolean;
  summaryContent?: ReactNode;
  inlineBlocked: boolean;
  saving: boolean;
  actionError?: string;
  targetError: string;
  rawPlayDates: Pick<JournalEntry, "started" | "finished">;
  fields: Omit<EditorContext, "setDraft" | "formId" | "renderField">;
  cover: Pick<
    PrincipalProps["cover"],
    "restoreError" | "restoreStatus" | "onRestore"
  > & { restoring: boolean };
  lookup: Omit<PrincipalProps, "main" | "cover">;
  onSelectTab: (id: string) => void;
  onValidationTab: (id: string) => void;
  onCancel: () => void;
}) {
  const {
    entry,
    draft,
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
    onSave,
    releaseError,
    setReleaseError,
  } = fields;
  const formId = editorId + "-form";
  const formBusy = saving || cover.restoring;
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
  const fieldProps = {
    draft,
    updateDraftField,
    renderField,
    formId,
    activeTab,
  };

  return (
    <div className="modal-body entry-editor">
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || formBusy) return;
          if (draft.cover && !coverSchema.safeParse(draft.cover).success) {
            onValidationTab("main");
            requestAnimationFrame(() =>
              document.getElementById(editorId + "-cover-url")?.focus(),
            );
            return;
          }
          if (!draft.title.trim()) {
            onValidationTab("main");
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
            onValidationTab("more");
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
            onValidationTab("main");
            return;
          }
          setPageError("");
          void onSave({
            ...draft,
            ...rawPlayDates,
            pages: pages.data,
          });
        }}
      />
      <fieldset
        className="entry-editor-fields"
        disabled={formBusy}
        aria-busy={formBusy}
      >
        <div
          className="editor-tabs"
          role="tablist"
          aria-label="Secciones del juego"
          onKeyDown={(event) => {
            if (
              inlineBlocked ||
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
            onSelectTab(tabs[next].id);
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
              disabled={
                inlineBlocked ||
                busy ||
                saving ||
                (embedded && dirty && tab.id === "summary")
              }
              onClick={() => onSelectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {embedded && (
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-summary"}
            aria-labelledby={editorId + "-tab-summary"}
            hidden={activeTab !== "summary"}
          >
            {summaryContent}
          </section>
        )}
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-main"}
          aria-labelledby={editorId + "-tab-main"}
          hidden={activeTab !== "main"}
        >
          <PrincipalPage
            {...lookup}
            main={{
              ...fieldProps,
              online,
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
              busy,
              omitSummaryFields: embedded,
              bookFields: embedded,
            }}
            cover={{
              ...cover,
              cover: draft.cover,
              title: draft.title,
              inputId: editorId + "-cover-url",
              formId,
              disabled: busy || formBusy,
              onChange: (value) => updateDraftField("cover", value),
            }}
          />
        </section>
        {!embedded && (
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-playthrough"}
            aria-labelledby={editorId + "-tab-playthrough"}
            hidden={activeTab !== "playthrough"}
          >
            <PlaythroughTab {...fieldProps} />
          </section>
        )}
        {!embedded && (
          <section
            className="editor-panel"
            role="tabpanel"
            id={editorId + "-panel-review"}
            aria-labelledby={editorId + "-tab-review"}
            hidden={activeTab !== "review"}
          >
            <ReviewTab {...fieldProps} omitSummaryFields={embedded} />
          </section>
        )}
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-more"}
          aria-labelledby={editorId + "-tab-more"}
          hidden={activeTab !== "more"}
        >
          <MoreTab
            {...fieldProps}
            online={online}
            dirty={dirty}
            entry={entry}
            runAction={runAction}
            members={members}
            grants={grants}
            recipientId={recipientId}
            setRecipientId={setRecipientId}
            busy={busy}
            onSave={onSave}
            releaseError={releaseError}
            setReleaseError={setReleaseError}
            hideMovedFields={embedded}
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
        {(!embedded || activeTab === "main" || activeTab === "more") && (
          <button
            type="button"
            className="text-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
        )}
        {(!embedded || activeTab === "main" || activeTab === "more") && (
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy || formBusy}
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
        )}
      </div>
    </div>
  );
}
