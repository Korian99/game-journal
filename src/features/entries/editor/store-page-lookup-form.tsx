import type { FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function StorePageLookupForm({
  url,
  loading,
  online,
  editing,
  error,
  onSubmit,
  onUrlChange,
  onManual,
}: {
  url: string;
  loading: boolean;
  online: boolean;
  editing: boolean;
  error: string;
  onSubmit: (event: FormEvent) => void;
  onUrlChange: (url: string) => void;
  onManual: () => void;
}) {
  return (
    <form className="entry-start-form" onSubmit={onSubmit} aria-busy={loading}>
      <label>
        Página de Steam o Nintendo
        <input
          type="url"
          required
          maxLength={2000}
          autoFocus
          placeholder="https://…"
          value={url}
          disabled={loading}
          onChange={(event) => onUrlChange(event.target.value)}
        />
      </label>
      <p className="fine-print">
        {editing
          ? "Se completarán los datos de este juego. Revisalos antes de guardar."
          : "Una página por consulta. Después podés revisar los datos y agregar otras páginas."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="text-button" onClick={onManual}>
          {editing ? "Volver a la edición" : "Completar manualmente"}
        </button>
        <button className="primary" disabled={loading || !online}>
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          {loading ? "Buscando…" : "Traer datos"}
        </button>
      </div>
    </form>
  );
}
