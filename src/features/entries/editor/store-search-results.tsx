import { ArrowRight } from "lucide-react";
import type { StoreSearchResult } from "@/features/stores/store-search";
import { GameCover } from "../game-cover";

export function StoreSearchResults({
  online,
  store,
  results,
  searching,
  previewing,
  error,
  searched,
  onSelect,
}: {
  online: boolean;
  store: "steam" | "nintendo";
  results: StoreSearchResult[];
  searching: boolean;
  previewing: boolean;
  error: string;
  searched: boolean;
  onSelect: (result: StoreSearchResult) => void;
}) {
  return (
    <>
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
                  onClick={() => void onSelect(result)}
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
    </>
  );
}
