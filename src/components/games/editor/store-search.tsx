"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/lib/offers/store-preview-contract";
import type { StoreSearchResult } from "@/lib/offers/store-search";

const searchSchema = z.object({
  results: z.array(
    z.object({
      store: z.literal("steam"),
      title: z.string(),
      id: z.string(),
      url: z.url(),
    }),
  ),
});

export function StoreSearch({
  online,
  onLoaded,
}: {
  online: boolean;
  onLoaded: (preview: StorePreview) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const activeSearch = useRef<AbortController | null>(null);
  const activePreview = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeSearch.current?.abort();
      activePreview.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!online) {
      activeSearch.current?.abort();
      activePreview.current?.abort();
      activeSearch.current = null;
      activePreview.current = null;
      setSearching(false);
      setPreviewing(false);
      setResults([]);
    }
  }, [online]);

  function cancelRequests() {
    activeSearch.current?.abort();
    activePreview.current?.abort();
    activeSearch.current = null;
    activePreview.current = null;
    setSearching(false);
    setPreviewing(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!online || term.length < 2 || term.length > 100) return;
    cancelRequests();
    const controller = new AbortController();
    activeSearch.current = controller;
    setSearching(true);
    setResults([]);
    setError("");
    setSearched(true);
    try {
      const response = await apiRequest(
        `/api/store-search?q=${encodeURIComponent(term)}`,
        "GET",
        undefined,
        searchSchema,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      );
      if (
        activeSearch.current === controller &&
        !controller.signal.aborted &&
        query.trim() === term
      )
        setResults(response.results);
    } catch (failure) {
      if (activeSearch.current === controller && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo buscar en Steam.",
        );
    } finally {
      if (activeSearch.current === controller) {
        activeSearch.current = null;
        if (!controller.signal.aborted) setSearching(false);
      }
    }
  }

  async function select(result: StoreSearchResult) {
    if (!online) return;
    cancelRequests();
    const controller = new AbortController();
    activePreview.current = controller;
    setPreviewing(true);
    setError("");
    try {
      const preview = await apiRequest(
        "/api/store-preview",
        "POST",
        { url: result.url },
        storePreviewSchema,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (
        activePreview.current === controller &&
        !controller.signal.aborted &&
        query.trim().length >= 2
      )
        onLoaded(preview);
    } catch (failure) {
      if (activePreview.current === controller && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudieron traer los datos.",
        );
    } finally {
      if (activePreview.current === controller) {
        activePreview.current = null;
        if (!controller.signal.aborted) setPreviewing(false);
      }
    }
  }

  return (
    <section className="store-search" aria-label="Buscar juegos en Steam">
      <form
        className="store-search-form"
        onSubmit={submit}
        aria-busy={searching || previewing}
      >
        <label htmlFor="store-title-search">Buscar por título en Steam</label>
        <div className="store-search-controls">
          <input
            id="store-title-search"
            type="search"
            minLength={2}
            maxLength={100}
            placeholder="Ej.: Portal 2"
            value={query}
            disabled={!online}
            onChange={(event) => {
              activeSearch.current?.abort();
              activePreview.current?.abort();
              activeSearch.current = null;
              activePreview.current = null;
              setSearching(false);
              setPreviewing(false);
              setQuery(event.target.value);
              setResults([]);
              setError("");
              setSearched(false);
            }}
          />
          <button
            className="primary"
            disabled={!online || query.trim().length < 2}
          >
            {searching || previewing ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Search size={16} />
            )}
            {searching
              ? "Buscar de nuevo"
              : previewing
                ? "Nueva búsqueda"
                : "Buscar"}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {searching && (
        <p className="store-search-status" role="status" aria-live="polite">
          Buscando en Steam… Podés seguir escribiendo mientras tanto.
        </p>
      )}
      {previewing && (
        <p className="store-search-status" role="status" aria-live="polite">
          Cargando los datos del juego…
        </p>
      )}
      {searched &&
        !searching &&
        !previewing &&
        !error &&
        results.length === 0 && (
          <p className="fine-print" role="status" aria-live="polite">
            No encontramos juegos con ese título.
          </p>
        )}
      {results.length > 0 && (
        <div className="store-search-result-panel" aria-live="polite">
          <p className="store-search-results-heading">
            {results.length}{" "}
            {results.length === 1 ? "juego encontrado" : "juegos encontrados"}
          </p>
          <ul className="store-search-results" aria-label="Resultados de Steam">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  disabled={!online || previewing}
                  onClick={() => void select(result)}
                >
                  <span className="store-search-result-title">
                    {result.title}
                  </span>
                  <small>Steam · Juego</small>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
