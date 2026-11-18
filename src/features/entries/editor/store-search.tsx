"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import {
  storePreviewSchema,
  type StorePreview,
} from "@/features/stores/store-preview-contract";
import { coverSchema } from "@/lib/covers";
import type { StoreSearchResult } from "@/features/stores/store-search";
import { StoreSearchForm } from "./store-search-form";
import { StoreSearchResults } from "./store-search-results";

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

function storeForSavedUrl(value?: string): "steam" | "nintendo" {
  return value?.toLowerCase().includes("nintendo") ? "nintendo" : "steam";
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
  const [store, setStore] = useState<"steam" | "nintendo">(initialStore);
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

  function changeQuery(value: string) {
    activeSearch.current?.abort();
    activePreview.current?.abort();
    activeSearch.current = null;
    activePreview.current = null;
    setSearching(false);
    setPreviewing(false);
    setQuery(value);
    userChangedSearch.current = true;
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
      <StoreSearchForm
        online={online}
        store={store}
        query={query}
        searching={searching}
        previewing={previewing}
        onSubmit={submit}
        onStoreChange={changeStore}
        onQueryChange={changeQuery}
      />
      <StoreSearchResults
        online={online}
        store={store}
        results={results}
        searching={searching}
        previewing={previewing}
        error={error}
        searched={searched}
        onSelect={select}
      />
      {editing && onBack && (
        <button type="button" className="text-button" onClick={onBack}>
          Volver a la edición
        </button>
      )}
    </section>
  );
}
