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
}: {
  cover?: Cover;
  title: string;
  inputId: string;
  formId: string;
  disabled: boolean;
  onChange: (cover: Cover) => void;
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
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? inputId + "-error" : undefined}
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
            disabled={disabled || !cover?.overrideUrl}
            onClick={() =>
              onChange({
                ...(cover?.providerUrl
                  ? { providerUrl: cover.providerUrl }
                  : {}),
                ...(cover?.provider ? { provider: cover.provider } : {}),
              })
            }
          >
            Restablecer portada de tienda
          </button>
        </div>
      </div>
    </section>
  );
}
