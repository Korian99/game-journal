"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link, LoaderCircle, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/lib/offers/store-preview-contract";
import { StoreSearch } from "./store-search";

export function EntryStart({
  step,
  online,
  url,
  setUrl,
  onPage,
  onManual,
  onLoaded,
  editing = false,
}: {
  step: "choose" | "page";
  editing?: boolean;
  online: boolean;
  url: string;
  setUrl: (url: string) => void;
  onPage: () => void;
  onManual: () => void;
  onLoaded: (preview: StorePreview) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (activeRequest.current || !online) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const preview = await apiRequest(
        "/api/store-preview",
        "POST",
        { url },
        storePreviewSchema,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (!controller.signal.aborted) onLoaded(preview);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudieron traer los datos.",
        );
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="modal-body entry-start">
      {step === "choose" ? (
        <>
          {!editing && <StoreSearch online={online} onLoaded={onLoaded} />}
          <div className="entry-start-options">
            <button
              className="entry-start-option"
              aria-label="Usar una página"
              onClick={onPage}
              disabled={!online}
            >
              <Link size={22} />
              <span>
                <strong>Usar una página</strong>
                <small>Traer datos de Steam o Nintendo</small>
              </span>
              <ArrowRight size={18} />
            </button>
            <button
              className="entry-start-option"
              aria-label="Completar manualmente"
              onClick={onManual}
            >
              <PenLine size={22} />
              <span>
                <strong>Completar manualmente</strong>
                <small>Empezar con el formulario vacío</small>
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <form
          className="entry-start-form"
          onSubmit={lookup}
          aria-busy={loading}
        >
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
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
              }}
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
            <button
              type="button"
              className="text-button"
              onClick={() => {
                activeRequest.current?.abort();
                onManual();
              }}
            >
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
      )}
      {!online && (
        <p className="fine-print">
          Necesitás conexión para consultar las tiendas.
        </p>
      )}
    </div>
  );
}
