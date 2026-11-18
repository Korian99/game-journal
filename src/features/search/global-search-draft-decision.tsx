import { LoaderCircle } from "lucide-react";

export function GlobalSearchDraftDecision({
  title,
  failed,
  saveError,
  working,
  blocked,
  online,
  onSave,
  onDiscard,
  onKeepEditing,
}: {
  title: string;
  failed: boolean;
  saveError: string;
  working: boolean;
  blocked: boolean;
  online: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <section className="global-search-decision" aria-label="Edición pendiente">
      <h3>Tenés una edición sin guardar.</h3>
      <p>Antes de abrir {title}, elegí qué hacer con ella.</p>
      {failed && (
        <p role="alert" className="error">
          {saveError || "No se pudo abrir la partida. Tu edición se conserva."}
        </p>
      )}
      <div className="button-row">
        <button
          className="primary"
          disabled={working || blocked || !online}
          onClick={onSave}
        >
          {working ? (
            <>
              <LoaderCircle size={14} className="save-spinner" />
              Guardando…
            </>
          ) : (
            "Guardar y abrir"
          )}
        </button>
        <button
          className="secondary"
          disabled={working || blocked}
          onClick={onDiscard}
        >
          Descartar y abrir
        </button>
        <button
          className="text-button"
          disabled={working}
          onClick={onKeepEditing}
        >
          Seguir editando
        </button>
      </div>
    </section>
  );
}
