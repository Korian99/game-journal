"use client";

import { statuses } from "@/lib/types";
import { viewStatuses } from "@/lib/journal/view-config";
import { CollectionSortControl } from "@/features/journal/collection-sort-control";
import { useJournalLocation } from "@/features/journal/use-journal-location";
import {
  ChevronDown,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const librarySortFields = [
  ["title", "Juego", "asc"],
  ["status", "Estado", "asc"],
  ["started", "Empecé", "desc"],
  ["finished", "Terminé", "desc"],
  ["hours", "Horas", "desc"],
  ["rating", "Reseña", "desc"],
  ["reason", "Por qué", "asc"],
  ["impression", "Impresiones", "asc"],
  ["notes", "Comentarios", "asc"],
] as const;

export function NotebookCollectionHeading({
  title,
  kicker,
  onAdd,
}: {
  title: string;
  kicker: string;
  onAdd: () => void;
}) {
  return (
    <header className="notebook-library-heading">
      <div>
        <span className="notebook-library-kicker">{kicker}</span>
        <h1>{title}</h1>
      </div>
      <button className="primary notebook-library-add" onClick={onAdd}>
        <Plus size={17} aria-hidden="true" />
        <span className="desktop-label">Agregar juego</span>
        <span className="mobile-label">Agregar</span>
      </button>
    </header>
  );
}

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
    scale,
    year,
    sort,
    setQuery,
    setStatus,
    setPlatform,
    setScale,
    setYear,
    setSort,
  } = location;
  const activeFilters = Number(!!year) + Number(!!status) + Number(!!platform) + Number(!!scale);

  return (
    <div className="notebook-library-controls">
      <NotebookCollectionHeading
        title="Biblioteca"
        kicker={`${year || "Todos los años"} · ${resultsCount} ${resultsCount === 1 ? "juego" : "juegos"}`}
        onAdd={onAdd}
      />

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
              <label>
                Escala
                <select aria-label="Filtrar escala" value={scale} onChange={(event) => setScale(event.target.value as typeof scale)}>
                  <option value="">Todas las escalas</option>
                  <option value="indie">Indie</option>
                  <option value="aa">AA</option>
                  <option value="aaa">AAA</option>
                </select>
              </label>
            </div>
          </details>

          <CollectionSortControl
            className="notebook-library-sort"
            label="Ordenar Biblioteca"
            fields={librarySortFields}
            sort={sort}
            setSort={setSort}
          />
        </div>
      </div>
    </div>
  );
}
