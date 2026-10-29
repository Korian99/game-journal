"use client";

import type {
  DiscountFilter,
  ReviewFilter,
} from "@/lib/journal/journal-location";
import { statuses } from "@/lib/types";
import { useJournalLocation } from "@/hooks/use-journal-location";
import { viewStatuses } from "@/lib/journal/view-config";
import {
  ChevronDown,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

export function JournalToolbar({
  location,
  platforms,
  yearOptions,
  busy,
  onRefresh,
}: {
  location: ReturnType<typeof useJournalLocation>;
  platforms: string[];
  yearOptions: string[];
  busy: boolean;
  onRefresh: () => void;
}) {
  const {
    view,
    query,
    status,
    discount,
    review,
    platform,
    year: selectedYear,
    setQuery,
    setStatus,
    setDiscount,
    setReview,
    setPlatform,
    setYear,
  } = location;
  const activeFilters =
    Number(["library", "journal"].includes(view) && !!selectedYear) +
    Number(["library", "journal"].includes(view) && !!status) +
    Number(view === "wishlist" && !!discount) +
    Number(view === "journal" && !!review) +
    Number(!!platform);
  return (
    <div className="notebook-view-toolbar">
      <div className="search">
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
              <select
                aria-label="Filtrar descuentos"
                value={discount}
                onChange={(e) => setDiscount(e.target.value as DiscountFilter)}
              >
                <option value="">Descuentos: todos</option>
                <option value="discounted">Con descuento</option>
                <option value="not-discounted">Sin descuento</option>
              </select>
            )}
            {["library", "journal"].includes(view) && (
              <select
                aria-label="Filtrar estado"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {(viewStatuses[view] ?? []).map((key) => (
                  <option key={key} value={key}>
                    {statuses[key]}
                  </option>
                ))}
              </select>
            )}
            {view === "journal" && (
              <select
                aria-label="Filtrar reseña"
                value={review}
                onChange={(e) => setReview(e.target.value as ReviewFilter)}
              >
                <option value="">Reseña: todas</option>
                <option value="with">Con reseña</option>
                <option value="without">Sin reseña</option>
              </select>
            )}
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
          </div>
        </details>
        {["wishlist", "upcoming"].includes(view) && (
          <button className="secondary" disabled={busy} onClick={onRefresh}>
            <RefreshCw size={15} />
            Actualizar precios
          </button>
        )}
      </div>
    </div>
  );
}
