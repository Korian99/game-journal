"use client";

import { coverImageUrlSchema, effectiveCoverUrl } from "@/lib/covers";
import type { Cover } from "@/lib/covers";
import { GameCover } from "../game-cover";

export function CoverEditor({
  cover,
  title,
  inputId,
  formId,
  disabled,
  onChange,
  onRestore,
  restoring = false,
  restoreError = "",
  restoreStatus = "",
}: {
  cover?: Cover;
  title: string;
  inputId: string;
  formId: string;
  disabled: boolean;
  onChange: (cover: Cover) => void;
  onRestore: () => void;
  restoring?: boolean;
  restoreError?: string;
  restoreStatus?: string;
}) {
  const value = cover?.overrideUrl ?? "";
  const invalid =
    !!value.trim() && !coverImageUrlSchema.safeParse(value).success;
  return (
    <section className="cover-editor" aria-label="Portada del juego">
      <GameCover cover={cover} title={title || "juego"} size="feature" />
      <div className="cover-editor-fields">
        <label htmlFor={inputId}>URL de portada</label>
        <input
          id={inputId}
          form={formId}
          type="text"
          inputMode="url"
          autoComplete="url"
          maxLength={2400}
          value={value}
          disabled={disabled || restoring}
          aria-invalid={invalid}
          aria-describedby={
            inputId + "-help" + (invalid ? " " + inputId + "-error" : "")
          }
          placeholder="https://assets.nintendo.com/…"
          onChange={(event) => {
            const overrideUrl = event.target.value;
            onChange({
              ...(cover?.providerUrl ? { providerUrl: cover.providerUrl } : {}),
              ...(cover?.provider ? { provider: cover.provider } : {}),
              ...(overrideUrl ? { overrideUrl } : {}),
            });
          }}
        />
        <details className="cover-editor-help" id={inputId + "-help"}>
          <summary>Portadas de otras consolas</summary>
          <p>
            Usá el enlace HTTPS directo de una imagen, no la página del juego.
            Abrí la imagen en otra pestaña y copiá su dirección.
          </p>
          <p>
            También se aceptan imágenes de MobyGames (cdn.mobygames.com),
            LaunchBox (images.launchbox-app.com) y eBay (i.ebayimg.com).
          </p>
        </details>
        {invalid && (
          <p
            className="cover-editor-error"
            id={inputId + "-error"}
            role="alert"
          >
            Usá una URL HTTPS de un proveedor aprobado.
          </p>
        )}
        <div className="cover-editor-actions">
          <span>
            {effectiveCoverUrl(cover) ? "Portada lista" : "Sin portada"}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={disabled || restoring}
            aria-busy={restoring}
            onClick={onRestore}
          >
            {restoring ? "Buscando portada…" : "Restablecer portada de tienda"}
          </button>
          {restoreError && (
            <span className="cover-editor-restore-error" role="alert">
              {restoreError}
            </span>
          )}
          {restoreStatus && <span role="status">{restoreStatus}</span>}
        </div>
      </div>
    </section>
  );
}
