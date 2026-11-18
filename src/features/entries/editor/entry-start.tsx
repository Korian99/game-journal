"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/features/stores/store-preview-contract";
import { StoreSearch } from "./store-search";
import { StorePageLookupForm } from "./store-page-lookup-form";

export function EntryStart({
  step,
  online,
  url,
  setUrl,
  onManual,
  onLoaded,
  initialQuery = "",
  initialUrl,
  editing = false,
}: {
  step: "choose" | "page" | "search";
  initialQuery?: string;
  initialUrl?: string;
  editing?: boolean;
  online: boolean;
  url: string;
  setUrl: (url: string) => void;
  onManual: () => void;
  onLoaded: (
    preview: StorePreview,
    options?: { replaceProviderCover?: boolean },
  ) => void;
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
      ) : step === "search" ? (
        <StoreSearch
          online={online}
          onLoaded={onLoaded}
          initialQuery={initialQuery}
          initialUrl={initialUrl}
          editing
          onBack={onManual}
        />
      ) : (
        <StorePageLookupForm
          url={url}
          loading={loading}
          online={online}
          editing={editing}
          error={error}
          onSubmit={lookup}
          onUrlChange={(value) => {
            setUrl(value);
            setError("");
          }}
          onManual={() => {
            activeRequest.current?.abort();
            onManual();
          }}
        />
      )}
      {!online && (
        <p className="fine-print">
          Necesitás conexión para consultar las tiendas.
        </p>
      )}
    </div>
  );
}
