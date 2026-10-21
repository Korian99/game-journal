"use client";
import { pagesSchema } from "@/lib/validation";

import { apiRequest } from "@/lib/api-client";
import { priceHistorySchema } from "@/lib/contracts";
import { statuses } from "@/lib/types";

import { formatDateTime } from "@/lib/journal/view-config";
import { ExternalLink, Trash2 } from "lucide-react";
import { OfferEditor } from "../../offers/offer-editor";
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
  runAction,
  priceHistory,
  setPriceHistory,
  pageUrl,
  setPageUrl,
  pageError,
  setPageError,
  busy,
  activeTab,
}: Pick<
  EditorContext,
  | "online"
  | "draft"
  | "updateDraftField"
  | "renderField"
  | "formId"
  | "offers"
  | "runAction"
  | "priceHistory"
  | "setPriceHistory"
  | "pageUrl"
  | "setPageUrl"
  | "pageError"
  | "setPageError"
  | "busy"
  | "activeTab"
>) {
  return (
    <>
      {activeTab === "main" && (
        <>
          {renderField("title", "Nombre del juego")}
          <PlatformPicker
            label="Plataformas disponibles"
            value={draft.platforms}
            onChange={(value) => updateDraftField("platforms", value)}
            form={formId}
            multiple
          />
          <div className="form-grid">
            <label>
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
            </label>
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
            {renderField("estimated", "Horas estimadas")}
          </div>
          <section className="editor-section">
            <h3>
              Páginas <span className="muted">· opcional</span>
            </h3>
            {offers.map((offer) => (
              <OfferEditor
                key={offer.id}
                disabled={!online || busy}
                offer={offer}
                runAction={runAction}
                showHistory={async () =>
                  setPriceHistory(
                    await apiRequest(
                      "/api/offers?id=" + offer.id,
                      "GET",
                      undefined,
                      priceHistorySchema,
                    ),
                  )
                }
              />
            ))}
            {(draft.pages ?? []).length > 0 && (
              <ul className="draft-pages" aria-label="Páginas del juego">
                {draft.pages?.map((page) => (
                  <li key={page}>
                    <a href={page} target="_blank" rel="noopener noreferrer">
                      {page}
                      <ExternalLink size={13} />
                    </a>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={"Quitar página " + page}
                      disabled={busy}
                      onClick={() =>
                        updateDraftField(
                          "pages",
                          draft.pages?.filter((value) => value !== page),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const pages = pagesSchema.safeParse([
                  ...(draft.pages ?? []),
                  pageUrl,
                ]);
                if (!pages.success) {
                  setPageError(
                    pages.error.issues[0]?.message ?? "Revisá el enlace.",
                  );
                  return;
                }
                updateDraftField("pages", pages.data);
                setPageUrl("");
                setPageError("");
              }}
            >
              <input
                type="url"
                aria-label="Enlace de página"
                placeholder="https://…"
                value={pageUrl}
                onChange={(event) => {
                  setPageUrl(event.target.value);
                  setPageError("");
                }}
                required
                disabled={busy}
              />
              <button className="secondary" disabled={busy}>
                Agregar
              </button>
            </form>
            {pageError && (
              <p className="error" role="alert">
                {pageError}
              </p>
            )}
            <p className="fine-print">
              Precios: Steam y Nintendo. Otras páginas: referencia.
            </p>
            {priceHistory && (
              <div className="history">
                {priceHistory.length ? (
                  priceHistory.map((quote) => (
                    <p key={quote.id}>
                      {formatDateTime(quote.created_at)} · {quote.currency}{" "}
                      {quote.price} · {quote.discount}% OFF
                    </p>
                  ))
                ) : (
                  <p>Todavía no hay cambios de precio registrados.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
