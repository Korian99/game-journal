"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import {
  reorderSeriesGames,
  seriesListSchema,
  seriesRecordSchema,
  type SeriesRecord,
} from "@/lib/series";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { Modal } from "@/components/ui/dialog";
import styles from "./series-manager.module.css";

export function SeriesManager({
  records,
  ready,
  disabled,
}: {
  records: JournalEntry[];
  ready: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
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
            .map((r) => [r.gameId, { id: r.gameId, title: r.title }]),
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
      setSelected(list[0]?.id ?? null);
      setDraft(null);
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
    if (open) void load();
  }, [open]);
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
  function close() {
    if (busy || !discardIfConfirmed()) return;
    setOpen(false);
    setDraft(null);
  }
  return (
    <>
      <button
        className="secondary"
        disabled={disabled || !ready}
        onClick={() => setOpen(true)}
      >
        Series
      </button>
      <Modal open={open} onClose={close} title="Series" closeDisabled={busy}>
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
              <aside aria-label="Tus series">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={startNew}
                >
                  Crear serie
                </button>
                {series.map((item) => (
                  <button
                    className={selected === item.id ? "primary" : "secondary"}
                    key={item.id}
                    disabled={busy}
                    onClick={() => switchDraft(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </aside>
              <div className={styles.editor}>
                {error && <p role="alert">{error}</p>}
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
                    <h3>{current.name}</h3>
                    <p>{current.gameIds.length} juegos</p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setDraft(current)}
                    >
                      Editar serie
                    </button>
                  </>
                ) : (
                  <p>Creá una serie y agregá juegos en el orden que quieras.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
