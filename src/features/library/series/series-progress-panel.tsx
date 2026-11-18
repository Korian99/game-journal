import { GameCover } from "@/features/entries/game-cover";
import type { getSeriesProgress } from "./series";
import styles from "./series-manager.module.css";

export function SeriesProgressPanel({
  progress,
  busy,
  onEdit,
}: {
  progress: ReturnType<typeof getSeriesProgress>;
  busy: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      <div className={styles.progressSummary}>
        <strong>
          {progress.completed} de {progress.total} juegos terminados
        </strong>
        <progress
          aria-label="Progreso de la serie"
          value={progress.completed}
          max={progress.total || 1}
        />
        <p>
          Cada juego cuenta una vez si tiene una partida en Terminados o
          Recuerdo fuera de la papelera.
        </p>
      </div>
      <p className={styles.nextGame}>
        {progress.next
          ? `Siguiente: ${progress.next.title}`
          : progress.total
            ? "Serie completada"
            : "Agregá juegos para empezar esta serie."}
      </p>
      <ol className={styles.progressGames} aria-label="Juegos de la serie">
        {progress.games.map((game, index) => (
          <li key={game.gameId}>
            <div className={styles.art} aria-hidden="true">
              {index + 1}
              <GameCover cover={game.cover} title={game.title} size="card" />
            </div>
            <div className={styles.gameInfo}>
              <strong>{game.title}</strong>
              <small>{game.completed ? "Terminado" : "Pendiente"}</small>
              {!game.available && (
                <small>Sin partidas activas; sigue en la serie.</small>
              )}
            </div>
          </li>
        ))}
      </ol>
      <button className="secondary" disabled={busy} onClick={onEdit}>
        Editar serie
      </button>
    </>
  );
}
