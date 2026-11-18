"use client";
import { pagesSchema } from "@/lib/validation";

import { apiRequest } from "@/lib/api-client";
import { priceHistorySchema } from "@/lib/contracts";
import { statuses } from "@/lib/types";

import type { FormEvent } from "react";
import { EntryPagesPanel } from "./entry-pages-panel";
import { entryPageFallbackError } from "./entry-page-form";
import { getOwnershipInfo, ownershipOptions } from "../ownership-badge";
import { PlatformPicker } from "../platform-picker";

import type { EditorContext } from "./editor-context";
export function MainTab({
  online,
  draft,
  updateDraftField,
  renderField,
  formId,
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
  activeTab,
  omitSummaryFields = false,
  bookFields = false,
}: Pick<
  EditorContext,
  | "online"
  | "draft"
  | "updateDraftField"
  | "renderField"
  | "formId"
  | "offers"
  | "targetDrafts"
  | "setTargetDraft"
  | "runAction"
  | "priceHistory"
  | "setPriceHistory"
  | "pageUrl"
  | "setPageUrl"
  | "pageError"
  | "setPageError"
  | "busy"
  | "activeTab"
> & { omitSummaryFields?: boolean; bookFields?: boolean }) {
  function addPage(event: FormEvent) {
    event.preventDefault();
    const pages = pagesSchema.safeParse([...(draft.pages ?? []), pageUrl]);
    if (!pages.success) {
      setPageError(pages.error.issues[0]?.message ?? entryPageFallbackError);
      return;
    }
    updateDraftField("pages", pages.data);
    setPageUrl("");
    setPageError("");
  }

  return (
    <>
      {activeTab === "main" && (
        <>
          {!omitSummaryFields && renderField("title", "Nombre del juego")}
          <PlatformPicker
            label="Plataformas disponibles"
            value={draft.platforms}
            onChange={(value) => updateDraftField("platforms", value)}
            form={formId}
            multiple
          />
          <div className="form-grid">
            {!omitSummaryFields && <label>
              Estado
              <select
                form={formId}
                aria-label="Estado"
                value={draft.status}
                onChange={(e) => updateDraftField("status", e.target.value)}
              >
                {Object.entries(statuses).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>}
            {bookFields && <>
              {renderField("focus", "Historia, gameplay o ambos")}
              {renderField("replay", "¿Lo rejugarías?")}
              <label>
                Hype
                <select form={formId} aria-label="Hype" value={draft.hype} onChange={(event) => updateDraftField("hype", event.target.value)}>
                  <option value="" disabled>Elegí el hype…</option>
                  {draft.hype && !["Bajo", "Medio", "Dunno", "Alto", "Hyper"].includes(draft.hype) && <option value={draft.hype}>{draft.hype} (actual)</option>}
                  {["Bajo", "Medio", "Dunno", "Alto", "Hyper"].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>
            </>}
            <label>
              Acceso al juego
              <select
                form={formId}
                value={getOwnershipInfo(draft.ownership).value}
                onChange={(event) =>
                  updateDraftField("ownership", event.target.value)
                }
              >
                <option value="" disabled>
                  Sin definir
                </option>
                {draft.ownership &&
                  !ownershipOptions.some(
                    (option) =>
                      option.value === getOwnershipInfo(draft.ownership).value,
                  ) && (
                    <option value={draft.ownership}>
                      {draft.ownership} (actual)
                    </option>
                  )}
                {ownershipOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {renderField("priority", "Prioridad")}
            {!omitSummaryFields && renderField("estimated", "Horas estimadas")}
          </div>
          <EntryPagesPanel
            online={online}
            offers={offers}
            targetDrafts={targetDrafts}
            setTargetDraft={setTargetDraft}
            formId={formId}
            runAction={runAction}
            busy={busy}
            pages={draft.pages}
            pageUrl={pageUrl}
            pageError={pageError}
            priceHistory={priceHistory}
            onAddPage={addPage}
            onPageUrlChange={(value) => {
              setPageUrl(value);
              setPageError("");
            }}
            onRemovePage={(page) =>
              updateDraftField(
                "pages",
                draft.pages?.filter((value) => value !== page),
              )
            }
            onShowHistory={async (offerId) =>
              setPriceHistory(
                await apiRequest(
                  "/api/offers?id=" + offerId,
                  "GET",
                  undefined,
                  priceHistorySchema,
                ),
              )
            }
          />
        </>
      )}
    </>
  );
}
