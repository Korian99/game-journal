import type { FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";

export function StoreSearchForm({
  online,
  store,
  query,
  searching,
  previewing,
  onSubmit,
  onStoreChange,
  onQueryChange,
}: {
  online: boolean;
  store: "steam" | "nintendo";
  query: string;
  searching: boolean;
  previewing: boolean;
  onSubmit: (event: FormEvent) => void;
  onStoreChange: (store: "steam" | "nintendo") => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <form
      className="store-search-form"
      onSubmit={onSubmit}
      aria-busy={searching || previewing}
    >
      <label htmlFor="store-provider">Tienda de búsqueda</label>
      <select
        id="store-provider"
        aria-label="Tienda de búsqueda"
        value={store}
        disabled={!online}
        onChange={(event) =>
          onStoreChange(event.target.value as "steam" | "nintendo")
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
          onChange={(event) => onQueryChange(event.target.value)}
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
  );
}
