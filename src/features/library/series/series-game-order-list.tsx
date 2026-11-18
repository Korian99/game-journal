export function SeriesGameOrderList({
  gameIds,
  games,
  busy,
  onMove,
  onRemove,
}: {
  gameIds: string[];
  games: { id: string; title: string }[];
  busy: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ol>
      {gameIds.map((id, index) => {
        const game = games.find((g) => g.id === id);
        return (
          <li key={id}>
            <span>{game?.title ?? "Juego no disponible"}</span>
            <button
              aria-label={"Mover " + (game?.title ?? "juego") + " arriba"}
              disabled={busy || index === 0}
              onClick={() => onMove(index, "up")}
            >
              ↑
            </button>
            <button
              aria-label={"Mover " + (game?.title ?? "juego") + " abajo"}
              disabled={busy || index === gameIds.length - 1}
              onClick={() => onMove(index, "down")}
            >
              ↓
            </button>
            <button
              aria-label={"Quitar " + (game?.title ?? "juego")}
              disabled={busy}
              onClick={() => onRemove(id)}
            >
              Quitar
            </button>
          </li>
        );
      })}
    </ol>
  );
}
