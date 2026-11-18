import type { FormEvent } from "react";

export const entryPageFallbackError = "Revisá el enlace.";

export function EntryPageForm({
  pageUrl,
  pageError,
  busy,
  onSubmit,
  onPageUrlChange,
}: {
  pageUrl: string;
  pageError: string;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onPageUrlChange: (value: string) => void;
}) {
  return (
    <>
      <form className="inline-form" onSubmit={onSubmit}>
        <input
          type="url"
          aria-label="Enlace de página"
          placeholder="https://…"
          value={pageUrl}
          onChange={(event) => onPageUrlChange(event.target.value)}
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
    </>
  );
}
