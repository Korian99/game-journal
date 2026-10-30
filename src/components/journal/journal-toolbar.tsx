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
  ArrowDownUp,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const collectionSortOptions = {
  journal: [
    ["title.asc", "Juego: A → Z"],
    ["title.desc", "Juego: Z → A"],
    ["year.asc", "Lanzamiento: más antiguo"],
    ["year.desc", "Lanzamiento: más reciente"],
    ["period.asc", "Período: antiguo a reciente"],
    ["period.desc", "Período: reciente a antiguo"],
    ["rating.asc", "Valoración: menor a mayor"],
    ["rating.desc", "Valoración: mayor a menor"],
    ["notes.asc", "Comentarios: A → Z"],
    ["notes.desc", "Comentarios: Z → A"],
  ],
  wishlist: [
    ["title.asc", "Juego: A → Z"],
    ["title.desc", "Juego: Z → A"],
    ["priority.asc", "Prioridad: menor a mayor"],
    ["priority.desc", "Prioridad: mayor a menor"],
    ["ownership.asc", "Acceso: A → Z"],
    ["ownership.desc", "Acceso: Z → A"],
    ["estimated.asc", "Hs. estimadas: menor a mayor"],
    ["estimated.desc", "Hs. estimadas: mayor a menor"],
  ],
  upcoming: [
    ["title.asc", "Juego: A → Z"],
    ["title.desc", "Juego: Z → A"],
    ["year.asc", "Salida: próxima primero"],
    ["year.desc", "Salida: más lejana primero"],
    ["hype.asc", "Hype: menor a mayor"],
    ["hype.desc", "Hype: mayor a menor"],
  ],
} as const;

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
    sort,
    setSort,
  } = location;
  const sortOptions =
    view === "journal" || view === "wishlist" || view === "upcoming"
      ? collectionSortOptions[view]
      : null;
  const sortValue = sort[0]
    ? `${sort[0].id}.${sort[0].desc ? "desc" : "asc"}`
    : "";
  const standardSort = sort[0]
    ? [
        { id: sort[0].id, desc: sort[0].desc },
        ...(sort[0].id === "title" ? [] : [{ id: "title", desc: false }]),
      ]
    : [];
  const customSort =
    sort.length > 0 &&
    (!sortOptions?.some(([value]) => value === sortValue) ||
      JSON.stringify(sort) !== JSON.stringify(standardSort));
  const customSortLabel =
    sortOptions?.find(([value]) => value === sortValue)?.[1] ??
    "Criterio personalizado";
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
        {sortOptions && (
          <label className="notebook-view-sort">
            <span>Ordenar</span>
            <ArrowDownUp size={16} aria-hidden="true" />
            <select
              aria-label={
                view === "journal"
                  ? "Ordenar Diario"
                  : view === "wishlist"
                    ? "Ordenar Lista de deseos"
                    : "Ordenar Próximos"
              }
              value={customSort ? "custom" : sortValue}
              onChange={(event) => {
                if (event.target.value === "custom") return;
                const [id, direction] = event.target.value.split(".");
                setSort(
                  id
                    ? [
                        { id, desc: direction === "desc" },
                        ...(id === "title"
                          ? []
                          : [{ id: "title", desc: false }]),
                      ]
                    : [],
                );
              }}
            >
              <option value="">Sin ordenar</option>
              {customSort && (
                <option value="custom">
                  {customSortLabel} · criterio combinado
                </option>
              )}
              {sortOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
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
