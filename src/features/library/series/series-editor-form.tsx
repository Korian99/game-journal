import type { ComponentProps } from "react";
import type { SeriesRecord } from "./series";
import { SeriesGameOrderList } from "./series-game-order-list";

type OrderListProps = ComponentProps<typeof SeriesGameOrderList>;

export function SeriesEditorForm({
  draft,
  busy,
  canDelete,
  gameQuery,
  games,
  availableGames,
  onNameChange,
  onGameQueryChange,
  onAddGame,
  onMoveGame,
  onRemoveGame,
  onSave,
  onDelete,
}: {
  draft: SeriesRecord;
  busy: boolean;
  canDelete: boolean;
  gameQuery: string;
  games: OrderListProps["games"];
  availableGames: OrderListProps["games"];
  onNameChange: (name: string) => void;
  onGameQueryChange: (query: string) => void;
  onAddGame: (id: string) => void;
  onMoveGame: OrderListProps["onMove"];
  onRemoveGame: OrderListProps["onRemove"];
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <label>
        Nombre
        <input
          autoFocus
          maxLength={80}
          disabled={busy}
          value={draft.name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>
      <p>Elegí juegos y ordenalos con los botones.</p>
      <SeriesGameOrderList
        gameIds={draft.gameIds}
        games={games}
        busy={busy}
        onMove={onMoveGame}
        onRemove={onRemoveGame}
      />
      <label>
        Buscar juegos
        <input
          type="search"
          aria-label="Buscar juegos para agregar a la serie"
          disabled={busy}
          value={gameQuery}
          onChange={(event) => onGameQueryChange(event.target.value)}
        />
      </label>
      <label>
        Agregar juego
        <select
          value=""
          disabled={busy}
          onChange={(event) => {
            if (event.target.value) onAddGame(event.target.value);
          }}
        >
          <option value="">Elegí un juego</option>
          {availableGames.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          className="primary"
          disabled={busy || !draft.name.trim()}
          onClick={onSave}
        >
          {busy ? "Guardando…" : "Guardar serie"}
        </button>
        {canDelete && (
          <button className="secondary" disabled={busy} onClick={onDelete}>
            Eliminar serie
          </button>
        )}
      </div>
    </>
  );
}
