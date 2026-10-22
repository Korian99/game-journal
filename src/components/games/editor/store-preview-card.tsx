import type { StorePreview } from "@/lib/offers/store-preview-contract";
import { formatDateTime } from "@/lib/journal/view-config";

const availability: Record<string, string> = {
  upcoming: "Próximamente",
  available: "Disponible",
  free: "Gratis",
  early_access: "Acceso anticipado",
  unavailable: "Sin precio disponible",
};
export function StorePreviewCard({ preview }: { preview: StorePreview }) {
  const quote = preview.quote;
  const price = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: quote.currency ?? "USD",
    }).format(value) +
    " " +
    (quote.currency ?? "");
  return (
    <aside className="store-preview" aria-label="Datos de la tienda">
      <div className="store-preview-heading">
        <strong>
          {preview.store === "steam" ? "Steam" : "Nintendo"} · {preview.region}
        </strong>
        <span>{availability[quote.status] ?? "Sin precio disponible"}</span>
      </div>
      <div className="store-preview-price">
        {quote.price !== null && quote.currency ? (
          <>
            {quote.regular !== null && quote.regular > quote.price && (
              <del>{price(quote.regular)}</del>
            )}
            <strong>{price(quote.price)}</strong>
            {quote.discount > 0 && (
              <span className="tag">{quote.discount}% OFF</span>
            )}
          </>
        ) : (
          <span className="muted">Precio no informado</span>
        )}
      </div>
      <small className="muted">
        Consulta: {formatDateTime(preview.checkedAt)}. Los datos cargados se
        pueden editar.
      </small>
    </aside>
  );
}
