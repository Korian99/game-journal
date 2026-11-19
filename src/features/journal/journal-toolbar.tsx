"use client";

import type {
  DiscountFilter,
  ReviewFilter,
  WishlistAccessFilter,
} from "@/lib/journal/journal-location";
import { statuses } from "@/lib/types";
import { ownershipOptions } from "@/lib/journal/ownership";
import { CollectionSortControl } from "./collection-sort-control";
import { useJournalLocation } from "./use-journal-location";
import { viewStatuses } from "@/lib/journal/view-config";
import {
  ChevronDown,
  RefreshCw,
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const wishlistAccessOptions = [
  { value: "owned", label: ownershipOptions[0].label },
  { value: "not-owned", label: ownershipOptions[1].label },
  { value: "family", label: ownershipOptions[2].label },
] as const;

const collectionSort = {
  journal: {
    label: "Ordenar Histórico",
    fields: [
      ["title", "Juego", "asc"],
      ["year", "Lanzamiento", "desc"],
      ["period", "Período", "desc"],
      ["rating", "Valoración", "desc"],
      ["notes", "Comentarios", "asc"],
    ],
  },
  wishlist: {
    label: "Ordenar Lista de deseos",
    fields: [
      ["title", "Juego", "asc"],
      ["priority", "Prioridad", "asc"],
      ["ownership", "Acceso", "asc"],
      ["estimated", "Hs. estimadas", "desc"],
    ],
  },
  upcoming: {
    label: "Ordenar Próximos",
    fields: [
      ["title", "Juego", "asc"],
      ["year", "Salida", "asc"],
      ["hype", "Hype", "desc"],
    ],
  },
} as const;

export function JournalToolbar({
  location,
  platforms,
  yearOptions,
  busy,
  refreshing,
  onRefresh,
}: {
  location: ReturnType<typeof useJournalLocation>;
  platforms: string[];
  yearOptions: string[];
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void | Promise<unknown>;
}) {
  const {
    view,
    query,
    status,
    discount,
    access,
    review,
    platform,
    scale,
    year: selectedYear,
    setQuery,
    setStatus,
    setDiscount,
    setAccess,
    setReview,
    setPlatform,
    setScale,
    setYear,
    sort,
    setSort,
  } = location;
  const sortControl =
    view === "journal" || view === "wishlist" || view === "upcoming"
      ? collectionSort[view]
      : null;
  const activeFilters =
    Number(["library", "journal"].includes(view) && !!selectedYear) +
    Number(["library", "journal"].includes(view) && !!status) +
    Number(view === "wishlist" && !!discount) +
    Number(view === "wishlist" && !!access) +
    Number(view === "journal" && !!review) +
    Number(!!platform) +
    Number(!!scale);
  return (
    <div className="notebook-view-toolbar">
      <div className="search notebook-library-search">
        <Search size={17} />
        <input
          maxLength={500}
          aria-label="Buscar juegos en esta lista"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en esta lista…"
        />
      </div>
      <div className="notebook-view-toolbar-actions">
        <details className="notebook-view-filters">
          <summary>
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Filtros</span>
            <span
              className="notebook-view-filter-count"
              aria-label={`${activeFilters} filtros activos`}
            >
              {activeFilters}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="notebook-view-filter-panel">
            {["library", "journal"].includes(view) && (
              <label className="year-filter">
                Año
                <select
                  value={selectedYear}
                  title={
                    view === "library"
                      ? "Terminados en el año o empezados sin fecha de fin. Sin fechas exactas, se usa el período registrado."
                      : undefined
                  }
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Todos los años</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {view === "wishlist" && (
              <label>
                Acceso
                <select
                  aria-label="Filtrar acceso"
                  value={access}
                  onChange={(event) =>
                    setAccess(event.target.value as WishlistAccessFilter)
                  }
                >
                  <option value="">Todos los accesos</option>
                  {wishlistAccessOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {view === "wishlist" && (
              <label>
                Descuentos
                <select
                  aria-label="Filtrar descuentos"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value as DiscountFilter)}
                >
                  <option value="">Todos</option>
                  <option value="discounted">Con descuento</option>
                  <option value="not-discounted">Sin descuento</option>
                </select>
              </label>
            )}
            {["library", "journal"].includes(view) && (
              <label>
                Estado
                <select
                  aria-label="Filtrar estado"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  {(viewStatuses[view] ?? []).map((key) => (
                    <option key={key} value={key}>
                      {statuses[key]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {view === "journal" && (
              <label>
                Reseña
                <select
                  aria-label="Filtrar reseña"
                  value={review}
                  onChange={(e) => setReview(e.target.value as ReviewFilter)}
                >
                  <option value="">Todas</option>
                  <option value="with">Con reseña</option>
                  <option value="without">Sin reseña</option>
                </select>
              </label>
            )}
            <label>
              Plataforma
              <select
                aria-label="Filtrar plataforma"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="">Todas las plataformas</option>
                {platforms.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Escala
              <select aria-label="Filtrar escala" value={scale} onChange={(event) => setScale(event.target.value as typeof scale)}>
                <option value="">Todas</option>
                <option value="indie">Indie</option>
                <option value="aa">AA</option>
                <option value="aaa">AAA</option>
              </select>
            </label>
          </div>
        </details>
        {sortControl && (
          <CollectionSortControl
            className="notebook-view-sort"
            label={sortControl.label}
            fields={sortControl.fields}
            sort={sort}
            setSort={setSort}
          />
        )}
        {["wishlist", "upcoming"].includes(view) && (
          <button
            className="secondary"
            disabled={busy || refreshing}
            aria-busy={refreshing}
            onClick={() => void onRefresh()}
          >
            {refreshing ? (
              <LoaderCircle size={15} className="save-spinner" aria-hidden="true" />
            ) : (
              <RefreshCw size={15} aria-hidden="true" />
            )}
            <span aria-live="polite" aria-atomic="true">
              {refreshing
                ? view === "upcoming"
                  ? "Actualizando precios y fechas…"
                  : "Actualizando precios…"
                : "Actualizar precios"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
