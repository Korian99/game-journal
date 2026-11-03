"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/lib/offers/store-preview-contract";
import { coverSchema } from "@/lib/covers";
import type { StoreSearchResult } from "@/lib/offers/store-search";
import { GameCover } from "../game-cover";

const searchSchema = z.object({
  results: z.array(
    z.object({
      store: z.enum(["steam", "nintendo"]),
      title: z.string(),
      id: z.string(),
      url: z.url(),
      platform: z.string().optional(),
      cover: coverSchema.optional(),
    }),
  ),
});

function storeForSavedUrl(value?: string): "steam" | "nintendo" | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname;
    if (hostname === "store.steampowered.com") return "steam";
    if (hostname === "nintendo.com" || hostname === "www.nintendo.com")
      return "nintendo";
  } catch {
    return null;
  }
  return null;
}

export function StoreSearch({
  online,
  onLoaded,
  initialQuery = "",
  initialUrl,
  editing = false,
  onBack,
}: {
  online: boolean;
  onLoaded: (
    preview: StorePreview,
    options?: { replaceProviderCover?: boolean },
  ) => void;
  initialQuery?: string;
  initialUrl?: string;
  editing?: boolean;
  onBack?: () => void;
}) {
  const initialStore = storeForSavedUrl(initialUrl);
  const [query, setQuery] = useState(initialQuery);
  const [store, setStore] = useState<"steam" | "nintendo">(
    initialStore ?? "steam",
  );
  const [results, setResults] = useState<StoreSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const activeSearch = useRef<AbortController | null>(null);
  const activePreview = useRef<AbortController | null>(null);
  const userChangedSearch = useRef(false);

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

  function changeStore(nextStore: "steam" | "nintendo") {
    userChangedSearch.current = true;
    cancelRequests();
    setStore(nextStore);
    setResults([]);
    setError("");
    setSearched(false);
  }

  async function search(term: string, provider: "steam" | "nintendo") {
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
        `/api/store-search?store=${provider}&q=${encodeURIComponent(term)}`,
        "GET",
        undefined,
        searchSchema,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      );
      if (
        activeSearch.current === controller &&
        !controller.signal.aborted &&
        query.trim() === term &&
        store === provider
      )
        setResults(response.results);
    } catch (failure) {
      if (activeSearch.current === controller && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo buscar en la tienda.",
        );
    } finally {
      if (activeSearch.current === controller) {
        activeSearch.current = null;
        if (!controller.signal.aborted) setSearching(false);
      }
    }
  }

  const searchRef = useRef(search);
  searchRef.current = search;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await search(query.trim(), store);
  }

  useEffect(() => {
    if (
      online &&
      !userChangedSearch.current &&
      initialStore &&
      initialQuery.trim().length >= 2 &&
      query.trim() === initialQuery.trim() &&
      store === initialStore
    )
      void searchRef.current(initialQuery.trim(), initialStore);
  }, [initialQuery, initialStore, online, query, store]);

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
        {
          url: result.url,
          ...(result.store === "nintendo" ? { includeUsPage: true } : {}),
        },
        storePreviewSchema,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (result.cover) preview.cover = result.cover;
      if (activePreview.current === controller && !controller.signal.aborted)
        onLoaded(preview, { replaceProviderCover: Boolean(result.cover) });
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
    <section
      className="store-search"
      aria-label="Buscar juegos en Steam o Nintendo"
    >
      <form
        className="store-search-form"
        onSubmit={submit}
        aria-busy={searching || previewing}
      >
        <label htmlFor="store-provider">Tienda de búsqueda</label>
        <select
          id="store-provider"
          aria-label="Tienda de búsqueda"
          value={store}
          disabled={!online}
          onChange={(event) =>
            changeStore(event.target.value as "steam" | "nintendo")
          }
        >
          <option value="steam">Steam</option>
          <option value="nintendo">Nintendo (Argentina)</option>
        </select>
        <label htmlFor="store-title-search">
          Buscar por título en {store === "steam" ? "Steam" : "Nintendo"}
        </label>
        <div className="store-search-controls">
          <input
            id="store-title-search"
            type="search"
            minLength={2}
            maxLength={100}
            placeholder={store === "steam" ? "Ej.: Portal 2" : "Ej.: Zelda"}
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
              userChangedSearch.current = true;
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
            {searching || previewing ? "Nueva búsqueda" : "Buscar"}
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
          Buscando en {store === "steam" ? "Steam" : "Nintendo"}… Podés seguir
          escribiendo mientras tanto.
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
          <ul
            className="store-search-results"
            aria-label="Resultados de tienda"
          >
            {results.map((result) => (
              <li key={`${result.store}:${result.id}`}>
                <button
                  type="button"
                  disabled={!online || previewing}
                  onClick={() => void select(result)}
                >
                  <GameCover
                    cover={result.cover}
                    title={result.title}
                    size="thumb"
                  />
                  <span className="store-search-result-title">
                    {result.title}
                  </span>
                  <small>
                    {result.store === "steam" ? "Steam" : "Nintendo"} ·{" "}
                    {result.platform ?? "Juego"}
                  </small>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && onBack && (
        <button type="button" className="text-button" onClick={onBack}>
          Volver a la edición
        </button>
      )}
    </section>
  );
}
