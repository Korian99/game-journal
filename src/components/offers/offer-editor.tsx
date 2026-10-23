"use client";
import { apiRequest } from "@/lib/api-client";
import { formatOfferPrice } from "@/lib/offers/format-offer-price";
import type { PerformJournalAction } from "@/lib/journal/journal-types";
import { type Offer } from "@/lib/types";
import { formatDateTime } from "@/lib/journal/view-config";
import { ExternalLink, Trash2 } from "lucide-react";

export function OfferEditor({
  offer,
  target,
  onTargetChange,
  formId,
  runAction,
  showHistory,
  disabled = false,
}: {
  offer: Offer;
  target: string;
  onTargetChange: (value: string) => void;
  formId: string;
  disabled?: boolean;
  runAction: PerformJournalAction;
  showHistory: () => void;
}) {
  return (
    <fieldset disabled={disabled} className="offer-editor-controls">
      <div className="offer-edit">
        <div className="offer-line">
          <a href={offer.url} target="_blank" rel="noopener noreferrer">
            {offer.store} · {offer.region}
            <ExternalLink size={12} />
          </a>
          <strong>{formatOfferPrice(offer)}</strong>
          {offer.discount > 0 && (
            <span className="discount">−{offer.discount}%</span>
          )}
        </div>
        <small className="muted">
          {offer.checked_at
            ? "Última consulta: " + formatDateTime(offer.checked_at)
            : "Consulta pendiente"}
          {offer.last_success_at
            ? " · Último precio válido: " +
              formatDateTime(offer.last_success_at)
            : ""}
          {offer.error ? " · " + offer.error : ""}
        </small>
        <div className="button-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={offer.watched}
              onChange={(e) =>
                runAction(() =>
                  apiRequest("/api/offers", "PATCH", {
                    id: offer.id,
                    watched: e.target.checked,
                  }),
                )
              }
            />
            Avisarme de descuentos
          </label>
          <label className="target-label">
            Objetivo ({offer.currency ?? "moneda de tienda"})
            <input
              type="number"
              min="0"
              step="any"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              form={formId}
              id={offer.id + "-target"}
            />
          </label>
          <button className="text-button" onClick={showHistory}>
            Historial
          </button>
          <button
            className="icon-button danger"
            aria-label="Eliminar enlace"
            onClick={() =>
              runAction(() =>
                apiRequest("/api/offers", "DELETE", { id: offer.id }),
              )
            }
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </fieldset>
  );
}
