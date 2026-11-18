import { GameCover } from "@/features/entries/game-cover";
import type { Cover } from "@/lib/covers";
import type { getSeriesProgress, SeriesRecord } from "./series";
import styles from "./series-manager.module.css";

export function SeriesList({
  rows,
  games,
  disabled,
  onOpen,
}: {
  rows: { item: SeriesRecord; progress: ReturnType<typeof getSeriesProgress> }[];
  games: { id: string; title: string; cover?: Cover }[];
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  if (!rows.length)
    return <p>Creá una serie y agregá juegos en el orden que quieras.</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.seriesTable} aria-label="Tus series">
        <thead>
          <tr>
            <th scope="col">Serie</th>
            <th scope="col">Progreso</th>
            <th scope="col">Siguiente</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, progress }) => {
            const firstGame = item.gameIds[0]
              ? games.find((game) => game.id === item.gameIds[0])
              : undefined;
            return (
              <tr key={item.id}>
                <th scope="row">
                  <button
                    className={styles.seriesName}
                    disabled={disabled}
                    onClick={() => onOpen(item.id)}
                    aria-label={`Abrir ${item.name}`}
                  >
                    <span className={styles.seriesCover}>
                      {firstGame ? (
                        <GameCover
                          cover={firstGame.cover}
                          title={firstGame.title}
                          size="thumb"
                        />
                      ) : (
                        <span aria-hidden="true">—</span>
                      )}
                    </span>
                    <span>{item.name}</span>
                  </button>
                  <small className={styles.mobileProgress}>
                    {progress.completed}/{progress.total} terminados
                  </small>
                </th>
                <td>
                  {progress.completed}/{progress.total} juegos terminados
                </td>
                <td>
                  {progress.next
                    ? progress.next.title
                    : progress.total
                      ? "Serie completada"
                      : "Sin juegos todavía"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
