"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import {
  reorderSeriesGames,
  getSeriesProgress,
  seriesListSchema,
  seriesRecordSchema,
  type SeriesRecord,
} from "./series";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { SeriesEditorForm } from "./series-editor-form";
import { SeriesList } from "./series-list";
import { SeriesProgressPanel } from "./series-progress-panel";
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
              <SeriesList
                rows={seriesProgress}
                games={games}
                disabled={busy || disabled}
                onOpen={switchDraft}
              />
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
                  <SeriesEditorForm
                    draft={draft}
                    busy={busy}
                    canDelete={!!current}
                    gameQuery={gameQuery}
                    games={games}
                    availableGames={filteredGames}
                    onNameChange={(name) => updateDraft((d) => ({ ...d, name }))}
                    onGameQueryChange={setGameQuery}
                    onAddGame={(id) =>
                      updateDraft((d) => ({
                        ...d,
                        gameIds: [...d.gameIds, id],
                      }))
                    }
                    onMoveGame={(index, direction) =>
                      updateDraft((d) => ({
                        ...d,
                        gameIds: reorderSeriesGames(
                          d.gameIds,
                          d.gameIds[index],
                          direction,
                        ),
                      }))
                    }
                    onRemoveGame={(id) =>
                      updateDraft((d) => ({
                        ...d,
                        gameIds: d.gameIds.filter((x) => x !== id),
                      }))
                    }
                    onSave={() => void save()}
                    onDelete={() => void remove()}
                  />
                ) : current ? (
                  <SeriesProgressPanel
                    progress={progress}
                    busy={busy}
                    onEdit={() => setDraft(current)}
                  />
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
