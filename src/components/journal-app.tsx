"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Library,
  Heart,
  CalendarDays,
  Users,
  Settings,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUpRight,
  RefreshCw,
  Download,
  LogOut,
  Bell,
  Menu,
  Gamepad2,
  Check,
  Trash2,
  Share2,
  ExternalLink,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Modal } from "./ui/dialog";
import { browserClient } from "@/lib/supabase/client";
import {
  emptyRecord,
  statuses,
  type JournalRecord,
  type Status,
  type Offer,
} from "@/lib/types";
import { pickSpreadsheet } from "@/lib/google";
import { enablePush, disablePush } from "@/lib/push-client";
import type { ImportPlan } from "@/lib/domain";
type Entry = JournalRecord & { gameId?: string };
const nav = [
  ["library", "Biblioteca", Library],
  ["journal", "Diario", BookOpen],
  ["wishlist", "Lista de deseos", Heart],
  ["upcoming", "Próximos", CalendarDays],
  ["shared", "Compartido conmigo", Users],
  ["settings", "Configuración", Settings],
] as const;
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "No se pudo completar la operación");
  return data;
}
const price = (o: Offer) =>
  o.price === null
    ? "Sin precio"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: o.currency ?? "USD",
      }).format(o.price) +
      " " +
      (o.currency ?? "");
export function JournalApp() {
  const [view, setView] = useState("library"),
    [records, setRecords] = useState<Entry[]>([]),
    [offers, setOffers] = useState<Offer[]>([]),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [platform, setPlatform] = useState(""),
    [sort, setSort] = useState<SortingState>([{ id: "title", desc: false }]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<Entry | null>(null),
    [busy, setBusy] = useState(false),
    [member, setMember] = useState<any>(null),
    [menu, setMenu] = useState(false),
    [sharing, setSharing] = useState<any>({
      shared: [],
      members: [],
      grants: [],
    }),
    [batch, setBatch] = useState<{
      batchId: string;
      plan: ImportPlan[];
    } | null>(null),
    [resolutions, setResolutions] = useState<
      Record<string, Record<string, string>>
    >({}),
    [notifications, setNotifications] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const [data, shared, alerts] = await Promise.all([
        api("/api/records"),
        api("/api/sharing"),
        api("/api/push"),
      ]);
      setRecords(data.records.map((r: any) => ({ ...emptyRecord, ...r })));
      setOffers(data.offers);
      setMember(data.member);
      setSharing(shared);
      setNotifications(alerts);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      localStorage.getItem("journal-theme") === "light",
    );
    load();
    const db = browserClient();
    const channel = db
      .channel("journal-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playthroughs" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_entries" },
        () => load(),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [load]);
  async function perform(fn: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (message) setNotice(message);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const games = useMemo(
    () =>
      records
        .filter((r) =>
          view === "wishlist"
            ? r.status === "wishlist"
            : view === "upcoming"
              ? r.status === "upcoming"
              : view === "journal"
                ? !["wishlist", "upcoming", "backlog"].includes(r.status)
                : !["wishlist", "upcoming"].includes(r.status),
        )
        .filter(
          (r) =>
            !query ||
            [r.title, r.platforms, r.device, r.period].some((v) =>
              String(v).toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .filter((r) => !status || r.status === status)
        .filter(
          (r) =>
            !platform ||
            (r.device + ";" + r.platforms)
              .split(";")
              .some((p) => p.trim() === platform),
        ),
    [records, view, query, status, platform],
  );
  const columns = useMemo<ColumnDef<Entry>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Juego",
        cell: ({ row }) => (
          <button
            className="game-cell"
            onClick={() => setEditing(row.original)}
          >
            <span className="game-mark">
              {row.original.title.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{row.original.title}</strong>
              <small>
                {row.original.device ||
                  row.original.platforms ||
                  "Plataforma sin definir"}
              </small>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "year",
        header: "Lanzamiento",
        cell: ({ getValue }) => getValue() ?? "—",
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <span className={"status " + getValue()}>
            {statuses[getValue() as Status]}
          </span>
        ),
      },
      {
        accessorKey: "period",
        header: "Período",
        cell: ({ getValue }) => getValue() || "—",
      },
      {
        accessorKey: "hours",
        header: "Horas",
        cell: ({ getValue }) => (getValue() == null ? "—" : getValue() + " h"),
      },
      {
        accessorKey: "rating",
        header: "Reseña",
        cell: ({ getValue, row }) => (
          <span className="score">
            {getValue() != null
              ? getValue() + "/100"
              : row.original.memorability != null
                ? row.original.memorability + "/10"
                : "—"}
          </span>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: games,
    columns,
    state: { sorting: sort },
    onSortingChange: setSort,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const title = nav.find((n) => n[0] === view)?.[1] ?? "Biblioteca";
  const platforms = [
    ...new Set(
      records.flatMap((r) =>
        (r.device + ";" + r.platforms)
          .split(";")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ),
  ].sort();
  async function importSheet() {
    setBusy(true);
    try {
      const selection = await pickSpreadsheet();
      const result = await api("/api/import", "POST", selection);
      setBatch(result);
      setResolutions({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function switchView(v: string) {
    setView(v);
    setQuery("");
    setStatus("");
    setPlatform("");
    setMenu(false);
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a href="/" className="brand">
          <span className="brand-icon">gj.</span>
          <span>
            game journal<span className="brand-sub">TU HISTORIA JUGANDO</span>
          </span>
        </a>
        <p className="nav-label">TU ESPACIO</p>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => switchView(key)}
              className={view === key ? "active" : ""}
            >
              <Icon size={18} />
              {label}
              {key === "wishlist" && (
                <span className="nav-count">
                  {records.filter((r) => r.status === "wishlist").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sync-dot" />
          Sincronizado con tu cuenta
          <p>{member?.display_name ?? "Game Journal"}</p>
          <button
            className="text-button"
            onClick={async () => {
              await disablePush().catch(() => {});
              await browserClient().auth.signOut();
              location.assign("/login");
            }}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={21} />
          </button>
          <span>
            MI COLECCIÓN <span className="separator">/</span> {title}
          </span>
          <span className="topbar-right">
            <Bell size={16} />
            {notifications.length ? (
              <span>{notifications.length} novedades</span>
            ) : (
              <span>Una partida a la vez</span>
            )}
            <span className="avatar">
              {(member?.display_name ?? "G").slice(0, 1).toUpperCase()}
            </span>
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                ARCHIVO PERSONAL / {new Date().getFullYear()}
              </span>
              <h1>
                {title}
                <span className="accent">.</span>
              </h1>
              <p className="muted">
                {view === "library"
                  ? "Cada juego tiene su historia. Esta es la tuya."
                  : view === "journal"
                    ? "Las partidas pasan. Los recuerdos quedan."
                    : view === "wishlist"
                      ? "La próxima gran aventura, al precio indicado."
                      : view === "upcoming"
                        ? "Un ojo en lo que viene."
                        : view === "shared"
                          ? "Historias de juego que eligieron compartir con vos."
                          : "Tu cuenta, tus datos, tus preferencias."}
              </p>
            </div>
            {!["shared", "settings"].includes(view) && (
              <button
                className="primary"
                onClick={() =>
                  setEditing({
                    ...emptyRecord,
                    status:
                      view === "wishlist"
                        ? "wishlist"
                        : view === "upcoming"
                          ? "upcoming"
                          : "backlog",
                  })
                }
              >
                <Plus size={17} />
                Agregar juego
              </button>
            )}
          </div>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Cerrar error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="banner" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
                ×
              </button>
            </div>
          )}
          {["library", "journal"].includes(view) && (
            <section className="stats">
              <div>
                <span>JUEGOS EN TU DIARIO</span>
                <strong>
                  {
                    records.filter(
                      (r) => !["wishlist", "upcoming"].includes(r.status),
                    ).length
                  }
                  <small>historias por contar</small>
                </strong>
              </div>
              <div>
                <span>AHORA JUGANDO</span>
                <strong>
                  {records.filter((r) => r.status === "playing").length}
                  <small>partidas en curso</small>
                </strong>
              </div>
              <div>
                <span>HORAS REGISTRADAS</span>
                <strong>
                  {records
                    .reduce((s, r) => s + (r.hours ?? 0), 0)
                    .toLocaleString("es-AR")}
                  <small>tiempo bien invertido</small>
                </strong>
              </div>
            </section>
          )}
          {view === "settings" ? (
            <section className="settings-grid">
              <article className="panel">
                <span className="eyebrow">PORTABILIDAD</span>
                <h2>Tus datos, siempre tuyos.</h2>
                <p>
                  Importá tu planilla y revisá los cambios antes de guardarlos.
                  Las notas editadas acá se conservan hasta que elijas cómo
                  resolver cada conflicto.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={importSheet}
                >
                  <Download size={16} />
                  Importar desde Google Sheets
                </button>
                <div className="button-row">
                  <a className="secondary" href="/api/export">
                    Exportar JSON
                  </a>
                  <a className="secondary" href="/api/export?format=csv">
                    Exportar CSV
                  </a>
                </div>
              </article>
              <article className="panel">
                <span className="eyebrow">PREFERENCIAS</span>
                <h2>A tu manera.</h2>
                <button
                  className="secondary"
                  onClick={() => {
                    const light =
                      !document.documentElement.classList.contains("light");
                    document.documentElement.classList.toggle("light", light);
                    localStorage.setItem(
                      "journal-theme",
                      light ? "light" : "dark",
                    );
                  }}
                >
                  Cambiar tema
                </button>
                <p>
                  Recibí una notificación cuando empiece una oferta o baje aún
                  más el precio de un juego que seguís.
                </p>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      perform(
                        enablePush,
                        "Notificaciones activadas en este dispositivo.",
                      )
                    }
                  >
                    Activar notificaciones
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      perform(disablePush, "Notificaciones desactivadas.")
                    }
                  >
                    Desactivar
                  </button>
                </div>
                <p className="fine-print">
                  Actualización de tiendas cada 3 horas, hora argentina. Los
                  precios conservan la moneda de cada tienda.
                </p>
              </article>
              {member?.role === "admin" && (
                <article className="panel">
                  <h2>Invitaciones privadas</h2>
                  <p>
                    Generá un enlace para invitar a alguien o recuperar su
                    acceso. Solo las cuentas invitadas pueden ver la app.
                  </p>
                  <AdminInvite onError={setError} />
                </article>
              )}
              <article className="panel">
                <h2>Últimas novedades</h2>
                {notifications.length ? (
                  notifications.slice(0, 10).map((n) => (
                    <div className="notification" key={n.id}>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <small>
                        {new Date(n.created_at).toLocaleString("es-AR")}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Todavía no hay alertas. Podés seguir ofertas desde la lista
                    de deseos.
                  </p>
                )}
              </article>
            </section>
          ) : view === "shared" ? (
            <section className="panel">
              {sharing.shared.length ? (
                sharing.shared.map((r: any) => (
                  <article className="shared-entry" key={r.shareId}>
                    <span className="eyebrow">
                      {r.owner} · {r.period}
                    </span>
                    <h2>{r.title}</h2>
                    <p>
                      {r.device} · {statuses[r.status as Status] ?? r.status} ·{" "}
                      {r.hours ?? "—"} h
                    </p>
                    <p>
                      Reseña: {r.rating ?? "—"} · Memorabilidad:{" "}
                      {r.memorability ?? "—"} · Impresiones:{" "}
                      {r.impression || "—"}
                    </p>
                  </article>
                ))
              ) : (
                <Empty
                  title="Las buenas partidas se comparten."
                  text="Las entradas que otras personas compartan con vos van a aparecer acá."
                />
              )}
            </section>
          ) : (
            <>
              <div className="list-toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar juegos"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar en tu colección…"
                  />
                </div>
                <select
                  aria-label="Filtrar estado"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar plataforma"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="">Todas las plataformas</option>
                  {platforms.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                {["wishlist", "upcoming"].includes(view) && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      perform(
                        () => api("/api/refresh", "POST", {}),
                        "Precios consultados.",
                      )
                    }
                  >
                    <RefreshCw size={15} />
                    Actualizar precios
                  </button>
                )}
              </div>
              <section className="table-panel">
                <div className="table-caption">
                  <span>
                    {loading
                      ? "Cargando…"
                      : games.length +
                        " " +
                        (games.length === 1 ? "juego" : "juegos")}
                  </span>
                  <span>EL SIGUIENTE RECUERDO ESTÁ POR EMPEZAR</span>
                </div>
                {!loading && games.length === 0 ? (
                  <Empty
                    title={
                      records.length
                        ? "Nada por acá, todavía."
                        : "Tu diario empieza con un juego."
                    }
                    text={
                      records.length
                        ? "Probá otro filtro o agregá un juego a esta lista."
                        : "Agregá tu primera partida o importá tu planilla desde Configuración."
                    }
                  />
                ) : (
                  <>
                    <div className="mobile-games">
                      {table.getRowModel().rows.map(({ original: r }) => (
                        <button
                          className="mobile-game"
                          key={r.id}
                          onClick={() => setEditing(r)}
                        >
                          <span className="game-mark">
                            {r.title.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="mobile-game-info">
                            <strong>{r.title}</strong>
                            <small>
                              {r.device ||
                                r.platforms ||
                                "Plataforma sin definir"}
                              {r.period ? " · " + r.period : ""}
                            </small>
                            <span className={"status " + r.status}>
                              {statuses[r.status]}
                            </span>
                          </span>
                          <span className="mobile-game-score">
                            {r.rating != null
                              ? r.rating + "/100"
                              : r.hours != null
                                ? r.hours + " h"
                                : "↗"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          {table.getHeaderGroups().map((g) => (
                            <tr key={g.id}>
                              {g.headers.map((h) => (
                                <th key={h.id}>
                                  <button
                                    onClick={h.column.getToggleSortingHandler()}
                                  >
                                    {flexRender(
                                      h.column.columnDef.header,
                                      h.getContext(),
                                    )}
                                    <ArrowUpDown size={12} />
                                  </button>
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody>
                          {table.getRowModel().rows.map((r) => (
                            <tr key={r.id}>
                              {r.getVisibleCells().map((c) => (
                                <td key={c.id}>
                                  {flexRender(
                                    c.column.columnDef.cell,
                                    c.getContext(),
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
              {["wishlist", "upcoming"].includes(view) && (
                <section className="offer-grid">
                  {games.map((g) => (
                    <article className="panel" key={g.id}>
                      <button
                        className="game-title-button"
                        onClick={() => setEditing(g)}
                      >
                        <h2>{g.title}</h2>
                        <ArrowUpRight size={17} />
                      </button>
                      {offers
                        .filter((o) => o.game_id === g.gameId)
                        .map((o) => (
                          <div className="offer-line" key={o.id}>
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {o.store === "steam" ? "Steam" : "Nintendo"} ·{" "}
                              {o.region}
                              <ExternalLink size={12} />
                            </a>
                            <strong>{price(o)}</strong>
                            {o.discount > 0 && (
                              <span className="discount">−{o.discount}%</span>
                            )}
                            {o.error && (
                              <small role="status">
                                Último precio conservado · falló la consulta
                              </small>
                            )}
                          </div>
                        ))}
                      {!offers.some((o) => o.game_id === g.gameId) && (
                        <p className="muted">
                          Agregá un enlace de tienda desde la ficha.
                        </p>
                      )}
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>GAME JOURNAL</span>
            <span>Para recordar lo que valió la pena jugar.</span>
          </footer>
        </div>
      </main>
      {editing && (
        <EntryEditor
          entry={editing}
          offers={offers.filter((o) => o.game_id === editing.gameId)}
          members={sharing.members}
          grants={sharing.grants.filter((g: any) => g.entry_id === editing.id)}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (entry) => {
            if (
              await perform(
                () => api("/api/records", "POST", entry),
                "Entrada guardada.",
              )
            )
              setEditing(null);
          }}
          onDelete={async () => {
            if (
              await perform(
                () => api("/api/records", "DELETE", { id: editing.id }),
                "Entrada eliminada.",
              )
            )
              setEditing(null);
          }}
          run={perform}
          reload={load}
        />
      )}
      {batch && (
        <Modal open onClose={() => setBatch(null)} title="Revisar importación">
          <div className="modal-body">
            <p>
              {batch.plan.filter((p) => p.kind === "add").length} nuevas ·{" "}
              {batch.plan.filter((p) => p.kind === "update").length} cambios ·{" "}
              {batch.plan.filter((p) => p.kind === "conflict").length} con
              conflictos
            </p>
            {batch.plan
              .filter((p) => p.kind !== "unchanged")
              .map((p, i) => (
                <article className="import-item" key={i}>
                  <strong>{p.incoming.title}</strong>
                  <span className="muted">
                    {" "}
                    ·{" "}
                    {
                      {
                        add: "Nueva",
                        update: "Cambios",
                        conflict: "Requiere revisión",
                        unchanged: "Sin cambios",
                      }[p.kind]
                    }
                  </span>
                  {Object.keys(p.changes).length > 0 && (
                    <p className="fine-print">
                      Campos:{" "}
                      {Object.keys(p.changes)
                        .filter((k) => !["raw", "links"].includes(k))
                        .join(", ")}
                    </p>
                  )}
                  {p.conflicts.map((field) => (
                    <label key={field}>
                      {field}
                      <select
                        value={resolutions[p.incoming.sourceKey]?.[field] ?? ""}
                        onChange={(e) =>
                          setResolutions({
                            ...resolutions,
                            [p.incoming.sourceKey]: {
                              ...resolutions[p.incoming.sourceKey],
                              [field]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Elegí qué conservar</option>
                        {field === "duplicate" ? (
                          <option value="skip">
                            Omitir duplicado para revisar después
                          </option>
                        ) : (
                          <>
                            <option value="app">
                              Conservar lo editado en la app
                            </option>
                            <option value="sheet">
                              Usar planilla:{" "}
                              {String((p.incoming as any)[field] ?? "vacío")}
                            </option>
                          </>
                        )}
                      </select>
                    </label>
                  ))}
                </article>
              ))}
            <button
              className="primary"
              disabled={
                busy ||
                batch.plan.some((p) =>
                  p.conflicts.some(
                    (f) => !resolutions[p.incoming.sourceKey]?.[f],
                  ),
                )
              }
              onClick={async () => {
                if (
                  await perform(
                    () =>
                      api("/api/import", "POST", {
                        action: "apply",
                        batchId: batch.batchId,
                        resolutions,
                      }),
                    "Importación aplicada.",
                  )
                )
                  setBatch(null);
              }}
            >
              Confirmar importación
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Gamepad2 size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function AdminInvite({ onError }: { onError: (s: string) => void }) {
  const [email, setEmail] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api("/api/admin", "POST", { email });
          setLink(r.link);
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Correo de la persona invitada
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <button className="secondary" disabled={busy}>
        Generar enlace privado
      </button>
      {link && (
        <label>
          Compartilo únicamente con esa persona
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </form>
  );
}
function EntryEditor({
  entry,
  offers,
  members,
  grants,
  busy,
  onClose,
  onSave,
  onDelete,
  run,
  reload,
}: {
  entry: Entry;
  offers: Offer[];
  members: any[];
  grants: any[];
  busy: boolean;
  onClose: () => void;
  onSave: (e: Entry) => Promise<void>;
  onDelete: () => Promise<void>;
  run: (f: () => Promise<unknown>, s?: string) => Promise<boolean>;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ ...entry }),
    [url, setUrl] = useState(""),
    [recipient, setRecipient] = useState(""),
    [history, setHistory] = useState<any[] | null>(null);
  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });
  const field = (key: keyof Entry, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        type={type}
        value={String(draft[key] ?? "")}
        onChange={(e) =>
          set(
            key,
            type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={entry.id ? "Tu partida" : "Agregar un juego"}
    >
      <div className="modal-body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
          }}
        >
          {field("title", "Nombre del juego")}
          <div className="form-grid">
            {field("year", "Año de lanzamiento", "number")}
            <label>
              Estado
              <select
                aria-label="Estado"
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {field("device", "Dónde lo jugaste")}
            {field("platforms", "Plataformas disponibles")}
            {field("period", "Año o período jugado")}
            {field("hours", "Horas jugadas", "number")}
            {field("started", "Fecha de inicio")}
            {field("finished", "Fecha de finalización")}
            {field("rating", "Reseña / 100", "number")}
            {field("memorability", "Memorabilidad / 10", "number")}
            {field("impression", "Impresiones")}
            {field("focus", "Historia, gameplay o ambos")}
            {field("replay", "¿Lo rejugarías?")}
            {field("ownership", "Comprado / acceso familiar")}
            {field("priority", "Prioridad", "number")}
            {field("hype", "Interés")}
            {field(
              "estimated",
              "Horas estimadas (principal / extra / completo)",
            )}
          </div>
          <label>
            ¿Por qué? · privado
            <textarea
              value={draft.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
          </label>
          <label>
            Comentarios · privados
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <div className="modal-actions">
            {entry.id && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  onSave({
                    ...draft,
                    id: undefined,
                    updated_at: undefined,
                    sourceKey: "",
                    status: "playing",
                    started: new Date().toISOString().slice(0, 10),
                    finished: "",
                    period: String(new Date().getFullYear()),
                    hours: null,
                    rating: null,
                    memorability: null,
                    impression: "",
                    notes: "",
                    reason: "",
                  })
                }
                disabled={busy}
              >
                Nueva partida
              </button>
            )}
            {entry.id && (
              <button
                type="button"
                className="danger text-button"
                onClick={onDelete}
                disabled={busy}
              >
                <Trash2 size={15} />
                Eliminar entrada
              </button>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar entrada"}
              <Check size={16} />
            </button>
          </div>
        </form>
        {entry.id && (
          <>
            <section className="editor-section">
              <h3>Ofertas de tiendas</h3>
              <p className="muted">
                Podés agregar varias regiones y tiendas para el mismo juego.
              </p>
              {offers.map((o) => (
                <OfferEditor
                  key={o.id}
                  offer={o}
                  run={run}
                  showHistory={async () =>
                    setHistory(await api("/api/offers?id=" + o.id))
                  }
                />
              ))}
              <form
                className="inline-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(
                      () =>
                        api("/api/offers", "POST", {
                          gameId: entry.gameId,
                          url,
                        }),
                      "Enlace agregado.",
                    )
                  ) {
                    setUrl("");
                    await reload();
                  }
                }}
              >
                <input
                  type="url"
                  aria-label="Enlace Steam o Nintendo"
                  placeholder="Enlace de Steam o Nintendo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <button className="secondary">Agregar</button>
              </form>
              {history && (
                <div className="history">
                  {history.length ? (
                    history.map((p) => (
                      <p key={p.id}>
                        {new Date(p.created_at).toLocaleString("es-AR")} ·{" "}
                        {p.currency} {p.price} · {p.discount}% OFF
                      </p>
                    ))
                  ) : (
                    <p>Todavía no hay cambios de precio registrados.</p>
                  )}
                </div>
              )}
            </section>
            <section className="editor-section">
              <h3>
                <Share2 size={16} />
                Compartir esta entrada
              </h3>
              <p className="muted">
                Solo se comparten la partida, las horas, las puntuaciones y las
                impresiones. Tus comentarios y motivos quedan privados.
              </p>
              {grants.map((g) => (
                <div className="button-row" key={g.id}>
                  <span>
                    {members.find((m) => m.id === g.recipient_id)
                      ?.display_name ?? "Persona invitada"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      run(
                        () => api("/api/sharing", "DELETE", { id: g.id }),
                        "Acceso revocado.",
                      )
                    }
                  >
                    Revocar acceso
                  </button>
                </div>
              ))}
              <div className="inline-form">
                <select
                  aria-label="Compartir con"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                >
                  <option value="">Elegí una persona</option>
                  {members
                    .filter((m) => !grants.some((g) => g.recipient_id === m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                </select>
                <button
                  className="secondary"
                  disabled={!recipient}
                  onClick={() =>
                    run(
                      () =>
                        api("/api/sharing", "POST", {
                          entry_id: entry.id,
                          recipient_id: recipient,
                        }),
                      "Entrada compartida.",
                    )
                  }
                >
                  Compartir
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
function OfferEditor({
  offer: o,
  run,
  showHistory,
}: {
  offer: Offer;
  run: (f: () => Promise<unknown>, s?: string) => Promise<boolean>;
  showHistory: () => void;
}) {
  const [target, setTarget] = useState(
    o.target_price == null ? "" : String(o.target_price),
  );
  return (
    <div className="offer-edit">
      <div className="offer-line">
        <a href={o.url} target="_blank" rel="noopener noreferrer">
          {o.store} · {o.region}
          <ExternalLink size={12} />
        </a>
        <strong>{price(o)}</strong>
        {o.discount > 0 && <span className="discount">−{o.discount}%</span>}
      </div>
      <small className="muted">
        {o.checked_at
          ? "Última consulta: " + new Date(o.checked_at).toLocaleString("es-AR")
          : "Consulta pendiente"}
        {o.last_success_at
          ? " · Último precio válido: " +
            new Date(o.last_success_at).toLocaleString("es-AR")
          : ""}
        {o.error ? " · " + o.error : ""}
      </small>
      <div className="button-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={o.watched}
            onChange={(e) =>
              run(() =>
                api("/api/offers", "PATCH", {
                  id: o.id,
                  watched: e.target.checked,
                  target_price: target === "" ? null : Number(target),
                }),
              )
            }
          />
          Seguir oferta
        </label>
        <label className="target-label">
          Objetivo ({o.currency ?? "moneda de tienda"})
          <input
            type="number"
            min="0"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() =>
              run(() =>
                api("/api/offers", "PATCH", {
                  id: o.id,
                  watched: o.watched,
                  target_price: target === "" ? null : Number(target),
                }),
              )
            }
          />
        </label>
        <button className="text-button" onClick={showHistory}>
          Historial
        </button>
        <button
          className="icon-button danger"
          aria-label="Eliminar enlace"
          onClick={() => run(() => api("/api/offers", "DELETE", { id: o.id }))}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
