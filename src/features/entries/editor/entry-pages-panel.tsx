import type { FormEvent } from "react";
import { formatDateTime } from "@/lib/journal/view-config";
import { OfferEditor } from "@/features/stores/offer-editor";
import type { EditorContext } from "./editor-context";
import { EntryPagesList } from "./entry-pages-list";
import { EntryPageForm } from "./entry-page-form";

export function EntryPagesPanel({
  online,
  offers,
  targetDrafts,
  setTargetDraft,
  formId,
  runAction,
  busy,
  pages,
  pageUrl,
  pageError,
  priceHistory,
  onAddPage,
  onPageUrlChange,
  onRemovePage,
  onShowHistory,
}: Pick<
  EditorContext,
  | "online"
  | "offers"
  | "targetDrafts"
  | "setTargetDraft"
  | "formId"
  | "runAction"
  | "busy"
  | "pageUrl"
  | "pageError"
  | "priceHistory"
> & {
  pages: EditorContext["draft"]["pages"];
  onAddPage: (event: FormEvent) => void;
  onPageUrlChange: (value: string) => void;
  onRemovePage: (page: string) => void;
  onShowHistory: (offerId: string) => Promise<void>;
}) {
  return (
    <section className="editor-section">
      <h3>
        Páginas <span className="muted">· opcional</span>
      </h3>
      {offers.map((offer) => (
        <OfferEditor
          key={offer.id}
          disabled={!online || busy}
          offer={offer}
          target={
            targetDrafts[offer.id] ??
            (offer.target_price == null ? "" : String(offer.target_price))
          }
          onTargetChange={(value) => setTargetDraft(offer.id, value)}
          formId={formId}
          runAction={runAction}
          showHistory={() => onShowHistory(offer.id)}
        />
      ))}
      <EntryPagesList pages={pages} busy={busy} onRemovePage={onRemovePage} />
      <EntryPageForm
        pageUrl={pageUrl}
        pageError={pageError}
        busy={busy}
        onSubmit={onAddPage}
        onPageUrlChange={onPageUrlChange}
      />
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
  );
}
