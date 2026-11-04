"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import {
  reorderSeriesGames,
  getSeriesProgress,
  seriesListSchema,
  seriesRecordSchema,
  type SeriesRecord,
} from "@/lib/series";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { GameCover } from "@/components/games/game-cover";
import styles from "./series-manager.module.css";

export function SeriesManager({
  records,
  ready,
  disabled,
  active,
}: {
  records: JournalEntry[];
  ready: boolean;
  disabled: boolean;
  active: boolean;
}) {
  const [series, setSeries] = useState<SeriesRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<SeriesRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [gameQuery, setGameQuery] = useState("");
  const mutation = useRef(false);
  const games = useMemo(
    () =>
      [
        ...new Map(
          records
            .filter((r): r is JournalEntry & { gameId: string } =>
              Boolean(r.gameId),
            )
            .map((r) => [
              r.gameId,
              { id: r.gameId, title: r.title, cover: r.cover },
            ]),
        ).values(),
      ].sort((a, b) => a.title.localeCompare(b.title)),
    [records],
  );
  const filteredGames = useMemo(
    () =>
      games.filter(
        (g) =>
          g.title
            .toLocaleLowerCase()
            .includes(gameQuery.trim().toLocaleLowerCase()) &&
          !draft?.gameIds.includes(g.id),
      ),
    [games, gameQuery, draft],
  );
  const current = series.find((item) => item.id === selected);
  const progress = useMemo(
    () => getSeriesProgress(current?.gameIds ?? [], records),
    [current, records],
  );
  const seriesProgress = useMemo(
    () =>
      series.map((item) => ({
        item,
        progress: getSeriesProgress(item.gameIds, records),
      })),
    [series, records],
  );
  function hasDraftChanges() {
    return Boolean(
      draft &&
      (current
        ? draft.name !== current.name ||
          draft.gameIds.join("\0") !== current.gameIds.join("\0")
        : draft.name.trim() !== "" || draft.gameIds.length > 0),
    );
  }
  function discardIfConfirmed() {
    return (
      !hasDraftChanges() || window.confirm("Descartar los cambios sin guardar?")
    );
  }
  async function load() {
    if (mutation.current) return;
    setBusy(true);
    setError("");
    try {
      const list = await apiRequest(
        "/api/series",
        "GET",
        undefined,
        seriesListSchema,
      );
      setSeries(list);
      setLoaded(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las series.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (active && ready && !loaded) void load();
  }, [active, ready, loaded]);
  function startNew() {
    if (!discardIfConfirmed()) return;
    setSelected(null);
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      updatedAt: new Date().toISOString(),
      gameIds: [],
    });
    setGameQuery("");
  }
  function switchDraft(next: string | null) {
    if (!discardIfConfirmed()) return;
    setSelected(next);
    setDraft(null);
  }
  function updateDraft(updater: (d: SeriesRecord) => SeriesRecord) {
    setDraft((d) => (d ? updater(d) : d));
  }
  async function save() {
    if (!draft || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await apiRequest(
        "/api/series",
        "POST",
        {
          ...(current ? { id: current.id, updatedAt: current.updatedAt } : {}),
          name: draft.name,
          gameIds: draft.gameIds,
        },
        seriesRecordSchema,
      );
      setSeries((list) =>
        current
          ? list.map((x) => (x.id === value.id ? value : x))
          : [...list, value],
      );
      setSelected(value.id);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !current ||
      mutation.current ||
      !window.confirm(
        "Eliminar esta serie? Los juegos y las partidas se conservan.",
      )
    )
      return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/series", "DELETE", {
        id: current.id,
        updatedAt: current.updatedAt,
      });
      setSeries((list) => list.filter((x) => x.id !== current.id));
      setSelected(null);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={styles.page} aria-labelledby="series-heading">
      <header className={styles.pageHeading}>
        <div>
          <h1 id="series-heading">Series</h1>
        </div>
        {!draft && !current && loaded && (
          <button
            className="primary"
            disabled={disabled || busy}
            onClick={startNew}
          >
            Crear serie
          </button>
        )}
      </header>
      <div className={styles.body}>
        {!ready ? (
          <p>Esperando los juegos completos…</p>
        ) : !loaded && busy ? (
          <p role="status">Cargando tus series…</p>
        ) : !loaded ? (
          <div>
            <p role="alert">{error || "No se pudieron cargar las series."}</p>
            <button className="secondary" onClick={() => void load()}>
              Reintentar carga
            </button>
          </div>
        ) : (
          <div className={styles.layout}>
            {error && <p role="alert">{error}</p>}
            {!draft && !current ? (
              series.length ? (
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
                      {seriesProgress.map(
                        ({ item, progress: itemProgress }) => {
                          const firstGame = item.gameIds[0]
                            ? games.find((game) => game.id === item.gameIds[0])
                            : undefined;
                          return (
                            <tr key={item.id}>
                              <th scope="row">
                                <button
                                  className={styles.seriesName}
                                  disabled={busy || disabled}
                                  onClick={() => switchDraft(item.id)}
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
                                  {itemProgress.completed}/{itemProgress.total} terminados
                                </small>
                              </th>
                              <td>
                                {itemProgress.completed}/{itemProgress.total}{" "}
                                juegos terminados
                              </td>
                              <td>
                                {itemProgress.next
                                  ? itemProgress.next.title
                                  : itemProgress.total
                                    ? "Serie completada"
                                    : "Sin juegos todavía"}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Creá una serie y agregá juegos en el orden que quieras.</p>
              )
            ) : (
              <div className={styles.editor}>
                <div className={styles.detailHeading}>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => switchDraft(null)}
                  >
                    Volver a Series
                  </button>
                  <h2>
                    {draft
                      ? current
                        ? current.name
                        : "Nueva serie"
                      : current?.name}
                  </h2>
                </div>
                {draft ? (
                  <>
                    <label>
                      Nombre
                      <input
                        autoFocus
                        maxLength={80}
                        disabled={busy}
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft((d) => ({ ...d, name: e.target.value }))
                        }
                      />
                    </label>
                    <p>Elegí juegos y ordenalos con los botones.</p>
                    <ol>
                      {draft.gameIds.map((id, index) => {
                        const game = games.find((g) => g.id === id);
                        return (
                          <li key={id}>
                            <span>{game?.title ?? "Juego no disponible"}</span>
                            <button
                              aria-label={
                                "Mover " + (game?.title ?? "juego") + " arriba"
                              }
                              disabled={busy || index === 0}
                              onClick={() =>
                                updateDraft((d) => ({
                                  ...d,
                                  gameIds: reorderSeriesGames(
                                    d.gameIds,
                                    d.gameIds[index],
                                    "up",
                                  ),
                                }))
                              }
                            >
                              ↑
                            </button>
                            <button
                              aria-label={
                                "Mover " + (game?.title ?? "juego") + " abajo"
                              }
                              disabled={
                                busy || index === draft.gameIds.length - 1
                              }
                              onClick={() =>
                                updateDraft((d) => ({
                                  ...d,
                                  gameIds: reorderSeriesGames(
                                    d.gameIds,
                                    d.gameIds[index],
                                    "down",
                                  ),
                                }))
                              }
                            >
                              ↓
                            </button>
                            <button
                              aria-label={"Quitar " + (game?.title ?? "juego")}
                              disabled={busy}
                              onClick={() =>
                                updateDraft((d) => ({
                                  ...d,
                                  gameIds: d.gameIds.filter((x) => x !== id),
                                }))
                              }
                            >
                              Quitar
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <label>
                      Buscar juegos
                      <input
                        type="search"
                        aria-label="Buscar juegos para agregar a la serie"
                        disabled={busy}
                        value={gameQuery}
                        onChange={(e) => setGameQuery(e.target.value)}
                      />
                    </label>
                    <label>
                      Agregar juego
                      <select
                        value=""
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.value)
                            updateDraft((d) => ({
                              ...d,
                              gameIds: [...d.gameIds, e.target.value],
                            }));
                        }}
                      >
                        <option value="">Elegí un juego</option>
                        {filteredGames.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <button
                        className="primary"
                        disabled={busy || !draft.name.trim()}
                        onClick={() => void save()}
                      >
                        {busy ? "Guardando…" : "Guardar serie"}
                      </button>
                      {current && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => void remove()}
                        >
                          Eliminar serie
                        </button>
                      )}
                    </div>
                  </>
                ) : current ? (
                  <>
                    <div className={styles.progressSummary}>
                      <strong>
                        {progress.completed} de {progress.total} juegos
                        terminados
                      </strong>
                      <progress
                        aria-label="Progreso de la serie"
                        value={progress.completed}
                        max={progress.total || 1}
                      />
                      <p>
                        Cada juego cuenta una vez si tiene una partida en
                        Terminados o Recuerdo fuera de la papelera.
                      </p>
                    </div>
                    <p className={styles.nextGame}>
                      {progress.next
                        ? `Siguiente: ${progress.next.title}`
                        : progress.total
                          ? "Serie completada"
                          : "Agregá juegos para empezar esta serie."}
                    </p>
                    <ol
                      className={styles.progressGames}
                      aria-label="Juegos de la serie"
                    >
                      {progress.games.map((game, index) => (
                        <li key={game.gameId}>
                          <div className={styles.art} aria-hidden="true">
                            {index + 1}
                            <GameCover
                              cover={game.cover}
                              title={game.title}
                              size="card"
                            />
                          </div>
                          <div className={styles.gameInfo}>
                            <strong>{game.title}</strong>
                            <small>
                              {game.completed ? "Terminado" : "Pendiente"}
                            </small>
                            {!game.available && (
                              <small>
                                Sin partidas activas; sigue en la serie.
                              </small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setDraft(current)}
                    >
                      Editar serie
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
