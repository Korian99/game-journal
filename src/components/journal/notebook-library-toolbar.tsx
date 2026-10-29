"use client";

import { statuses } from "@/lib/types";
import { viewStatuses } from "@/lib/journal/view-config";
import { useJournalLocation } from "@/hooks/use-journal-location";
import {
  ArrowDownUp,
  ChevronDown,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const librarySortOptions = [
  ["title.asc", "Juego: A → Z"],
  ["title.desc", "Juego: Z → A"],
  ["status.asc", "Estado: A → Z"],
  ["status.desc", "Estado: Z → A"],
  ["started.desc", "Empecé: más reciente"],
  ["started.asc", "Empecé: más antiguo"],
  ["finished.desc", "Terminé: más reciente"],
  ["finished.asc", "Terminé: más antiguo"],
  ["hours.desc", "Horas: mayor a menor"],
  ["hours.asc", "Horas: menor a mayor"],
  ["rating.desc", "Reseña: mayor a menor"],
  ["rating.asc", "Reseña: menor a mayor"],
  ["reason.asc", "Por qué: A → Z"],
  ["reason.desc", "Por qué: Z → A"],
  ["impression.asc", "Impresiones: A → Z"],
  ["impression.desc", "Impresiones: Z → A"],
  ["notes.asc", "Comentarios: A → Z"],
  ["notes.desc", "Comentarios: Z → A"],
] as const;

export function NotebookLibraryToolbar({
  location,
  platforms,
  yearOptions,
  resultsCount,
  onAdd,
}: {
  location: ReturnType<typeof useJournalLocation>;
  platforms: string[];
  yearOptions: string[];
  resultsCount: number;
  onAdd: () => void;
}) {
  const {
    query,
    status,
    platform,
    year,
    sort,
    setQuery,
    setStatus,
    setPlatform,
    setYear,
    setSort,
  } = location;
  const activeFilters = Number(!!year) + Number(!!status) + Number(!!platform);
  const sortValue = sort[0]
    ? sort[0].id + "." + (sort[0].desc ? "desc" : "asc")
    : "";
  const standardSort = sort[0]
    ? [
        { id: sort[0].id, desc: sort[0].desc },
        ...(sort[0].id === "title" ? [] : [{ id: "title", desc: false }]),
      ]
    : [];
  const customSort =
    sort.length > 0 &&
    (!librarySortOptions.some(([value]) => value === sortValue) ||
      JSON.stringify(sort) !== JSON.stringify(standardSort));
  const customSortLabel =
    librarySortOptions.find(([value]) => value === sortValue)?.[1] ??
    "Orden sin criterio reconocido";

  return (
    <div className="notebook-library-controls">
      <header className="notebook-library-heading">
        <div>
          <span className="notebook-library-kicker">
            {year || "Todos los años"} · {resultsCount}{" "}
            {resultsCount === 1 ? "juego" : "juegos"}
          </span>
          <h1>Biblioteca</h1>
        </div>
        <button className="primary notebook-library-add" onClick={onAdd}>
          <Plus size={17} aria-hidden="true" />
          <span className="desktop-label">Agregar juego</span>
          <span className="mobile-label">Agregar</span>
        </button>
      </header>

      <div className="notebook-library-toolbar">
        <label className="notebook-library-search">
          <Search size={18} aria-hidden="true" />
          <input
            maxLength={500}
            aria-label="Buscar juegos en esta lista"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en Biblioteca…"
          />
        </label>

        <div className="notebook-library-toolbar-actions">
          <details className="notebook-library-filters">
            <summary>
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span>Filtros</span>
              <span
                className="notebook-filter-count"
                aria-label={`${activeFilters} filtros activos`}
              >
                {activeFilters}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="notebook-filter-panel">
              <label>
                Año
                <select
                  aria-label="Filtrar año"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                >
                  <option value="">Todos los años</option>
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select
                  aria-label="Filtrar estado"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {(viewStatuses.library ?? []).map((key) => (
                    <option key={key} value={key}>
                      {statuses[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Plataforma
                <select
                  aria-label="Filtrar plataforma"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                >
                  <option value="">Todas las plataformas</option>
                  {platforms.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          <label className="notebook-library-sort">
            <span>Ordenar</span>
            <ArrowDownUp size={16} aria-hidden="true" />
            <select
              aria-label="Ordenar Biblioteca"
              value={customSort ? "custom" : sortValue}
              onChange={(event) => {
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
              {librarySortOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
