"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, LoaderCircle, Search } from "lucide-react";
import { Modal } from "../../ui/dialog";
import { searchJournal } from "@/lib/journal/search";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { ResourceState } from "@/lib/resource";
import { statuses, type Offer } from "@/lib/types";
import { formatDate } from "@/lib/journal/view-config";

export type SearchDecision = "save" | "discard";
export function GlobalSearch({
  records,
  offers,
  state,
  online,
  blocked,
  dirty,
  saveError,
  onChoose,
  onRetry,
}: {
  records: JournalEntry[];
  offers: Offer[];
  state: Pick<ResourceState<unknown>, "status" | "error" | "checkedAt">;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  saveError: string;
  onChoose: (
    entry: JournalEntry,
    decision?: SearchDecision,
  ) => Promise<boolean>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const [pending, setPending] = useState<JournalEntry | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const navigating = useRef(false);
  const groups = useMemo(
    () => searchJournal(records, query, offers),
    [records, query, offers],
  );
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  let remaining = limit;
  const visible = groups.flatMap((group) => {
    const entries = group.entries.slice(0, Math.max(0, remaining));
    remaining -= entries.length;
    return entries.length ? [{ ...group, entries }] : [];
  });
  const ready = state.checkedAt !== null;
  function show() {
    if (blocked) return;
    navigating.current = false;
    setQuery("");
    setLimit(30);
    setPending(null);
    setFailed(false);
    setOpen(true);
  }
  function close() {
    if (!working) {
      setOpen(false);
      setPending(null);
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "k"
      )
        return;
      if (
        document.querySelector('[role="dialog"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (!blocked) {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function choose(entry: JournalEntry, decision?: SearchDecision) {
    if (working || blocked) return;
    if (dirty && !decision) {
      setPending(entry);
      setFailed(false);
      return;
    }
    setWorking(true);
    setFailed(false);
    try {
      if (await onChoose(entry, decision)) {
        navigating.current = true;
        setOpen(false);
        setPending(null);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  }
  function buttons() {
    return Array.from(
      results.current?.querySelectorAll<HTMLButtonElement>(
        "[data-search-result]",
      ) ?? [],
    );
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="global-search-trigger"
        aria-label="Buscar en todos mis juegos"
        title="Buscar en todos mis juegos (Ctrl+K)"
        disabled={blocked}
        onClick={show}
      >
        <Search size={17} />
        <span>Buscar en todos mis juegos</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Buscar en todos mis juegos"
        onEscapeKeyDown={(event) => {
          if (working) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!navigating.current) trigger.current?.focus();
        }}
      >
        <div className="global-search-body">
          <label className="global-search-input">
            <Search size={19} aria-hidden="true" />
            <input
              ref={input}
              autoFocus
              type="search"
              aria-label="Buscar en todos mis juegos"
              placeholder="Nombre, consola o período…"
              maxLength={500}
              value={query}
              disabled={working}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(30);
                setPending(null);
                setFailed(false);
              }}
              onKeyDown={(event) => {
                if (
                  (event.key === "ArrowDown" || event.key === "Enter") &&
                  !pending
                ) {
                  const first = buttons()[0];
                  if (first) {
                    event.preventDefault();
                    if (event.key === "Enter") first.click();
                    else first.focus();
                  }
                }
              }}
            />
          </label>
          {!online && (
            <p className="global-search-notice" role="status">
              Sin conexión. Buscando en los últimos datos cargados.
            </p>
          )}
          {state.status === "loading" && (
            <p className="global-search-notice" role="status">
              <LoaderCircle size={14} className="save-spinner" />
              {ready ? "Actualizando juegos…" : "Cargando juegos…"}
            </p>
          )}
          {state.error && (
            <div className="global-search-notice error" role="alert">
              {ready
                ? "No se pudieron actualizar los juegos. Se conserva la última versión."
                : "No se pudieron cargar tus juegos."}{" "}
              <button className="text-button" onClick={onRetry}>
                Reintentar
              </button>
            </div>
          )}
          {pending ? (
            <section
              className="global-search-decision"
              aria-label="Edición pendiente"
            >
              <h3>Tenés una edición sin guardar.</h3>
              <p>Antes de abrir {pending.title}, elegí qué hacer con ella.</p>
              {failed && (
                <p role="alert" className="error">
                  {saveError ||
                    "No se pudo abrir la partida. Tu edición se conserva."}
                </p>
              )}
              <div className="button-row">
                <button
                  className="primary"
                  disabled={working || blocked || !online}
                  onClick={() => void choose(pending, "save")}
                >
                  {working ? (
                    <>
                      <LoaderCircle size={14} className="save-spinner" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar y abrir"
                  )}
                </button>
                <button
                  className="secondary"
                  disabled={working || blocked}
                  onClick={() => void choose(pending, "discard")}
                >
                  Descartar y abrir
                </button>
                <button
                  className="text-button"
                  disabled={working}
                  onClick={close}
                >
                  Seguir editando
                </button>
              </div>
            </section>
          ) : (
            <>
              {ready && !query.trim() && (
                <p className="global-search-empty">
                  Buscá entre todos tus juegos, sin los filtros de la lista.
                </p>
              )}
              {ready && query.trim() && !groups.length && (
                <p className="global-search-empty">No hay coincidencias.</p>
              )}
              {failed && (
                <p role="alert" className="error">
                  La partida ya no está disponible. Volvé a buscar.
                </p>
              )}
              {groups.length > 0 && (
                <p className="global-search-count" role="status">
                  {groups.length} {groups.length === 1 ? "juego" : "juegos"} ·{" "}
                  {total} {total === 1 ? "partida" : "partidas"}
                </p>
              )}
              <div
                ref={results}
                className="global-search-results"
                onKeyDown={(event) => {
                  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
                  if (!keys.includes(event.key)) return;
                  const items = buttons();
                  const index = items.indexOf(
                    event.target as HTMLButtonElement,
                  );
                  if (index < 0) return;
                  event.preventDefault();
                  if (event.key === "ArrowUp" && index === 0) {
                    input.current?.focus();
                    return;
                  }
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : event.key === "ArrowDown"
                          ? Math.min(index + 1, items.length - 1)
                          : index - 1;
                  items[next]?.focus();
                }}
              >
                {visible.map((group) => (
                  <section className="global-search-group" key={group.key}>
                    <h3>{group.title}</h3>
                    {group.entries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="global-search-result"
                        data-search-result
                        disabled={working || blocked}
                        aria-label={[
                          "Abrir partida",
                          entry.title,
                          statuses[entry.status],
                          entry.device || entry.platforms || "Sin consola",
                          entry.period,
                          formatDate(entry.started),
                          formatDate(entry.finished),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        onClick={() => void choose(entry)}
                      >
                        <span className={"status " + entry.status}>
                          {statuses[entry.status]}
                        </span>
                        <span className="global-search-result-meta">
                          <span>
                            {entry.device || entry.platforms || "Sin consola"}
                          </span>
                          <small>
                            {[
                              entry.period,
                              entry.started
                                ? "Empecé: " + formatDate(entry.started)
                                : "",
                              entry.finished
                                ? "Terminé: " + formatDate(entry.finished)
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sin período registrado"}
                          </small>
                        </span>
                        <ArrowDownLeft size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                ))}
              </div>
              {total > limit && (
                <button
                  type="button"
                  className="secondary global-search-more"
                  onClick={() => setLimit((value) => value + 30)}
                >
                  Mostrar más partidas ({total - limit})
                </button>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
