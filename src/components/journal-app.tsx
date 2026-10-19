"use client";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
} from "@tanstack/react-table";
import { Modal } from "./ui/dialog";
import { WishlistPrice } from "./wishlist-price";
import { PlatformPicker } from "./platform-picker";
import {
  OwnershipBadge,
  getOwnershipInfo,
  ownershipOptions,
} from "./ownership-badge";
import { wishlistPlatforms, hasActiveDiscount } from "@/lib/wishlist-display";
import { HypeBadge } from "./hype-badge";
import { PriorityMark } from "./priority-mark";
import { BackupStatus } from "./backup-status";
import {
  ReviewMark,
  LibraryPlaythrough,
  LibraryFinishReason,
} from "./library-game-details";
import { useJournalLocation } from "@/lib/use-journal-location";
import type { JournalLocation, JournalView } from "@/lib/journal-location";
import { summarizeGames } from "@/lib/view-summary";
import { ReleaseField } from "./release-field";
import {
  releaseLabel,
  releaseOrder,
  parseRelease,
  compareReleases,
  releaseHasArrived,
} from "@/lib/releases";
import { releaseSchema, pagesSchema } from "@/lib/validation";
import {
  viewStatuses,
  dateOrder,
  formatDate,
  formatDateTime,
  periodOrder,
  reviewOrder,
  matchesViewYear,
  viewYears,
} from "@/lib/view-config";
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
const libraryTextFields = [
  { key: "reason", label: "Por qué" },
  { key: "impression", label: "Impresiones" },
  { key: "notes", label: "Comentarios adicionales" },
] as const;
const journalTextFields = libraryTextFields.filter(
  ({ key }) => key !== "reason",
);
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
export function JournalApp({
  initialLocation,
}: { initialLocation?: JournalLocation } = {}) {
  const {
    view,
    query,
    status,
    platform,
    year: selectedYear,
    sort,
    setView,
    setQuery,
    setStatus,
    setPlatform,
    setYear,
    setSort,
  } = useJournalLocation(initialLocation);
  const [records, setRecords] = useState<Entry[]>([]),
    [offers, setOffers] = useState<Offer[]>([]),
    [releaseNow, setReleaseNow] = useState(() => new Date()),
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
  useEffect(() => {
    if (view !== "upcoming") return;
    const update = () => setReleaseNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [view]);
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
  const yearOptions = useMemo(
    () =>
      [
        ...new Set([
          ...viewYears(
            records.filter((record) =>
              (viewStatuses[view] ?? []).includes(record.status),
            ),
            view,
          ),
          ...(selectedYear ? [selectedYear] : []),
        ]),
      ].sort((a, b) => Number(b) - Number(a)),
    [records, view, selectedYear],
  );
  const entriesInView = useMemo(
    () =>
      records.filter(
        (record) =>
          (viewStatuses[view] ?? []).includes(record.status) &&
          matchesViewYear(record, view, selectedYear),
      ),
    [records, view, selectedYear],
  );
  const games = useMemo(
    () =>
      entriesInView
        .filter(
          (r) =>
            !query ||
            [
              r.title,
              r.platforms,
              r.device,
              r.period,
              ...(["wishlist", "upcoming"].includes(view)
                ? wishlistPlatforms(
                    r,
                    offers.filter((o) => o.game_id === r.gameId),
                  )
                : []),
            ].some((v) =>
              String(v).toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .filter((r) => !status || r.status === status)
        .filter(
          (r) =>
            !platform ||
            (["wishlist", "upcoming"].includes(view)
              ? wishlistPlatforms(
                  r,
                  offers.filter((o) => o.game_id === r.gameId),
                )
              : (r.device + ";" + r.platforms).split(";").map((p) => p.trim())
            ).includes(platform),
        ),
    [entriesInView, query, status, platform, view, offers],
  );
  const summary = useMemo(
    () => summarizeGames(games, view === "library" ? selectedYear : ""),
    [games, view, selectedYear],
  );
  function entryRowClass(record: Entry): string | undefined {
    if (view === "upcoming" && releaseHasArrived(record, releaseNow))
      return "upcoming-released";
    if (
      view === "wishlist" &&
      hasActiveDiscount(
        offers.filter((offer) => offer.game_id === record.gameId),
      )
    )
      return "wishlist-discounted";
    return undefined;
  }
  const columns = useMemo<ColumnDef<Entry>[]>(() => {
    const general: ColumnDef<Entry>[] = [
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
        id: "year",
        accessorFn: releaseOrder,
        header: "Lanzamiento",
        sortingFn: (a, b) =>
          compareReleases(
            a.original,
            b.original,
            sort.find((item) => item.id === "year")?.desc,
          ),
        sortUndefined: false,
        sortDescFirst: false,
        cell: ({ row }) => releaseLabel(row.original),
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
        id: "period",
        accessorFn: (record) => periodOrder(record.period),
        header: "Período",
        sortUndefined: "last",
        sortingFn: "basic",
        cell: ({ row }) => row.original.period || "—",
      },
      {
        accessorKey: "hours",
        header: "Horas",
        cell: ({ getValue }) => (getValue() == null ? "—" : getValue() + " h"),
      },
      {
        id: "rating",
        accessorFn: reviewOrder,
        header: "Reseña",
        sortingFn: "basic",
        sortUndefined: "last",
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className="score">
            {row.original.rating != null
              ? row.original.rating + "/100"
              : row.original.memorability != null
                ? row.original.memorability + "/10"
                : "—"}
          </span>
        ),
      },
    ];
    if (view === "library")
      return [
        {
          ...general[0],
          cell: ({ row }) => (
            <button
              className="game-cell library-game-cell"
              onClick={() => setEditing(row.original)}
            >
              <ReviewMark rating={row.original.rating} />
              <span className="library-game-identity">
                <strong>{row.original.title}</strong>
                <small>
                  {row.original.device ||
                    row.original.platforms ||
                    "Plataforma sin definir"}
                </small>
                <span className={"status " + row.original.status}>
                  {statuses[row.original.status]}
                </span>
              </span>
            </button>
          ),
        },
        {
          ...general[2],
          sortingFn: (a, b) =>
            statuses[a.original.status].localeCompare(
              statuses[b.original.status],
              "es",
            ),
        },
        {
          id: "started",
          accessorFn: (record) => dateOrder(record.started),
          header: "Partida",
          sortingFn: "basic",
          sortUndefined: "last",
          cell: ({ row }) => <LibraryPlaythrough record={row.original} />,
        },
        {
          id: "finished",
          accessorFn: (record) => dateOrder(record.finished),
          header: "Terminé",
          sortingFn: "basic",
          sortUndefined: "last",
          cell: ({ row }) => formatDate(row.original.finished) || "—",
        },
        {
          ...general[4],
          id: "hours",
          accessorFn: (record) => record.hours ?? undefined,
          sortingFn: "basic",
          sortUndefined: "last",
        },
        { ...general[5], accessorFn: (record) => record.rating ?? undefined },
        ...libraryTextFields.map(({ key, label }): ColumnDef<Entry> => ({
          accessorKey: key,
          header: label,
          cell: ({ getValue, row }) =>
            key === "reason" ? (
              <LibraryFinishReason record={row.original} />
            ) : (
              <span className="entry-text-cell">
                {getValue<string>() || "—"}
              </span>
            ),
        })),
      ];
    if (view === "journal")
      return [
        general[0],
        general[1],
        general[3],
        {
          id: "memorability",
          accessorFn: (record) => record.memorability ?? undefined,
          header: "Memorabilidad",
          sortingFn: "basic",
          sortUndefined: "last",
          sortDescFirst: true,
          cell: ({ getValue }) => (
            <span className="score">
              {getValue() == null ? "—" : getValue() + "/10"}
            </span>
          ),
        },
        ...journalTextFields.map(({ key, label }): ColumnDef<Entry> => ({
          accessorKey: key,
          header: label,
          cell: ({ getValue }) => (
            <span className="entry-text-cell">{getValue<string>() || "—"}</span>
          ),
        })),
      ];
    const storeName: ColumnDef<Entry> = {
      ...general[0],
      header: "Nombre",
      cell: ({ row }) => (
        <button
          className={
            "game-cell " +
            (view === "upcoming" ? "upcoming-name" : "wishlist-name")
          }
          onClick={() => setEditing(row.original)}
        >
          <span>
            <strong>{row.original.title}</strong>
            <small>
              {wishlistPlatforms(
                row.original,
                offers.filter((o) => o.game_id === row.original.gameId),
              ).join(" · ") || "Plataforma sin confirmar"}
            </small>
          </span>
        </button>
      ),
    };
    if (view === "upcoming")
      return [
        {
          ...general[1],
          header: "Fecha de salida",
          cell: ({ row }) => (
            <span className="upcoming-release-date">
              <span>{releaseLabel(row.original)}</span>
              {releaseHasArrived(row.original, releaseNow) && (
                <span className="released-badge">Ya salió</span>
              )}
            </span>
          ),
        },
        storeName,
        {
          id: "hype",
          accessorFn: (record) => {
            const rank = ["Bajo", "Medio", "Dunno", "Alto", "Hyper"].indexOf(
              record.hype.trim(),
            );
            return rank < 0 ? undefined : rank;
          },
          header: "Hype",
          sortingFn: "basic",
          sortUndefined: "last",
          sortDescFirst: true,
          cell: ({ row }) => <HypeBadge value={row.original.hype} />,
        },
      ];
    if (view !== "wishlist") return general;
    return [
      {
        id: "priority",
        accessorFn: (r) => r.priority ?? undefined,
        header: "Prioridad",
        sortUndefined: "last",
        sortDescFirst: false,
        sortingFn: (a, b) =>
          String(a.original.priority ?? "").localeCompare(
            String(b.original.priority ?? ""),
            "es",
            { numeric: true, sensitivity: "base" },
          ),
        cell: ({ row }) => <PriorityMark value={row.original.priority} />,
      },
      storeName,
      {
        id: "price",
        header: "Precio",
        enableSorting: false,
        cell: ({ row }) => (
          <WishlistPrice
            offers={offers.filter((o) => o.game_id === row.original.gameId)}
          />
        ),
      },
      {
        accessorKey: "ownership",
        header: "Acceso",
        sortingFn: (a, b) =>
          getOwnershipInfo(a.original.ownership).label.localeCompare(
            getOwnershipInfo(b.original.ownership).label,
            "es",
          ),
        cell: ({ getValue }) => (
          <OwnershipBadge value={getValue<string>() || ""} />
        ),
      },
      {
        accessorKey: "estimated",
        header: "Hs. Estimadas",
        cell: ({ getValue }) => getValue() || "—",
      },
    ];
  }, [view, offers, sort, releaseNow]);
  const table = useReactTable({
    data: games,
    columns,
    state: {
      sorting: sort,
      columnVisibility:
        view === "library"
          ? { status: false, finished: false, hours: false, rating: false }
          : {},
    },
    onSortingChange: setSort,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const title = nav.find((n) => n[0] === view)?.[1] ?? "Biblioteca";
  const platforms = [
    ...new Set(
      ["wishlist", "upcoming"].includes(view)
        ? records
            .filter((r) => (viewStatuses[view] ?? []).includes(r.status))
            .flatMap((r) =>
              wishlistPlatforms(
                r,
                offers.filter((o) => o.game_id === r.gameId),
              ),
            )
        : records.flatMap((r) =>
            (r.device + ";" + r.platforms)
              .split(";")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
    ),
    ...(platform ? [platform] : []),
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
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
  function switchView(v: JournalView) {
    setView(v);
    setMenu(false);
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a href="/" className="brand">
          <span className="brand-icon">gj.</span>
          <span>Game Journal</span>
        </a>
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
          <span className="topbar-right">
            {notifications.length > 0 && (
              <span
                className="notification-count"
                aria-label={notifications.length + " notificaciones"}
              >
                <Bell size={16} />
                {notifications.length}
              </span>
            )}
            <span className="avatar">
              {(member?.display_name ?? "G").slice(0, 1).toUpperCase()}
            </span>
          </span>
        </header>
        <div
          className={
            "content" +
            (["library", "journal", "wishlist", "upcoming"].includes(view)
              ? " collection-content"
              : "")
          }
        >
          <div className="page-heading">
            <div>
              <h1>
                {title}
                <span className="accent">.</span>
              </h1>
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
                          : view === "journal"
                            ? "remembered"
                            : "playing",
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
          <BackupStatus details={view === "settings"} />
          {view === "settings" ? (
            <section className="settings-grid">
              <article className="panel">
                <h2>Datos</h2>
                <p>Revisá los cambios antes de importar.</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={importSheet}
                >
                  <Download size={16} />
                  Importar desde Google Sheets
                </button>
                <div className="button-row">
                  <a className="secondary" href="/api/export?format=xlsx">
                    Exportar Excel
                  </a>
                  <a className="secondary" href="/api/export">
                    Respaldo JSON
                  </a>
                  <a className="secondary" href="/api/export?format=csv">
                    Exportar CSV
                  </a>
                </div>
                <p className="fine-print">
                  Excel y JSON incluyen todos tus juegos, páginas e historial de
                  precios. CSV incluye los juegos. Guardá una copia fuera de la
                  app.
                </p>
              </article>
              <article className="panel">
                <h2>Preferencias</h2>
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
                <p>Alertas de precio para los juegos que seguís.</p>
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
                  Tiendas: cada 3 h · moneda original.
                </p>
              </article>
              {member?.role === "admin" && (
                <article className="panel">
                  <h2>Invitaciones privadas</h2>
                  <p>Acceso solo por invitación.</p>
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
                      <small>{formatDateTime(n.created_at)}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sin alertas.</p>
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
                <Empty title="Sin juegos compartidos" />
              )}
            </section>
          ) : (
            <>
              <div className="list-toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    maxLength={500}
                    aria-label="Buscar juegos"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar…"
                  />
                </div>
                {["library", "journal"].includes(view) && (
                  <label className="year-filter">
                    Año
                    <select
                      value={selectedYear}
                      title={
                        view === "library"
                          ? "Terminados en el año o empezados sin fecha de fin. Sin fechas exactas, se usa el período registrado."
                          : undefined
                      }
                      onChange={(e) => setYear(e.target.value)}
                    >
                      <option value="">Todos los años</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!["journal", "upcoming"].includes(view) && (
                  <select
                    aria-label="Filtrar estado"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    {(viewStatuses[view] ?? []).map((key) => (
                      <option key={key} value={key}>
                        {statuses[key]}
                      </option>
                    ))}
                  </select>
                )}
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
              <div
                className={
                  ["library", "journal"].includes(view)
                    ? "collection-layout with-summary"
                    : "collection-layout"
                }
              >
                <section className="table-panel">
                  <div className="table-caption">
                    <span>
                      {loading
                        ? "Cargando…"
                        : games.length +
                          " " +
                          (games.length === 1 ? "juego" : "juegos")}
                    </span>
                    {view === "library" && (
                      <select
                        className="library-sort"
                        aria-label="Ordenar Biblioteca"
                        value={
                          sort[0]
                            ? sort[0].id + "." + (sort[0].desc ? "desc" : "asc")
                            : ""
                        }
                        onChange={(event) => {
                          const [id, direction] = event.target.value.split(".");
                          setSort(
                            id
                              ? [
                                  { id, desc: direction === "desc" },
                                  ...(id === "title"
                                    ? []
                                    : [{ id: "title", desc: false }]),
                                ]
                              : [],
                          );
                        }}
                      >
                        <option value="">Sin ordenar</option>
                        <option value="title.asc">Juego: A → Z</option>
                        <option value="title.desc">Juego: Z → A</option>
                        <option value="status.asc">Estado: A → Z</option>
                        <option value="status.desc">Estado: Z → A</option>
                        <option value="started.desc">
                          Empecé: más reciente
                        </option>
                        <option value="started.asc">Empecé: más antiguo</option>
                        <option value="finished.desc">
                          Terminé: más reciente
                        </option>
                        <option value="finished.asc">
                          Terminé: más antiguo
                        </option>
                        <option value="hours.desc">Horas: mayor a menor</option>
                        <option value="hours.asc">Horas: menor a mayor</option>
                        <option value="rating.desc">
                          Reseña: mayor a menor
                        </option>
                        <option value="rating.asc">
                          Reseña: menor a mayor
                        </option>
                        <option value="reason.asc">Por qué: A → Z</option>
                        <option value="reason.desc">Por qué: Z → A</option>
                        <option value="impression.asc">
                          Impresiones: A → Z
                        </option>
                        <option value="impression.desc">
                          Impresiones: Z → A
                        </option>
                        <option value="notes.asc">Comentarios: A → Z</option>
                        <option value="notes.desc">Comentarios: Z → A</option>
                      </select>
                    )}
                  </div>
                  {!loading && games.length === 0 ? (
                    <Empty
                      title="No hay juegos"
                      text={
                        records.length
                          ? "Cambiá los filtros o agregá un juego."
                          : "Agregá un juego o importá desde Configuración."
                      }
                    />
                  ) : (
                    <>
                      <div className="mobile-games">
                        {table.getRowModel().rows.map(({ original: r }) => (
                          <button
                            className={["mobile-game", entryRowClass(r)]
                              .filter(Boolean)
                              .join(" ")}
                            key={r.id}
                            ) : view === "wishlist" ? (
                              <PriorityMark value={r.priority} />
                            onClick={() => setEditing(r)}
                          >
                            {view === "library" ? (
                              <ReviewMark rating={r.rating} />
                            ) : (
                              <span className="game-mark">
                                {r.title.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span className="mobile-game-info">
                              <strong>{r.title}</strong>
                              {view === "upcoming" ? (
                                <>
                                  <small>
                                    {wishlistPlatforms(
                                      r,
                                      offers.filter(
                                        (o) => o.game_id === r.gameId,
                                      ),
                                    ).join(" · ") || "Plataforma sin confirmar"}
                                  </small>
                                  <small>
                                    Fecha de salida: {releaseLabel(r)}
                                    {releaseHasArrived(r, releaseNow) && (
                                      <span className="released-badge">
                                        Ya salió
                                      </span>
                                    )}
                                  </small>
                                  <small className="upcoming-mobile-hype">
                                    Hype <HypeBadge value={r.hype} />
                                  </small>
                                </>
                              ) : view === "wishlist" ? (
                                <>
                                  <small>
                                    {wishlistPlatforms(
                                      r,
                                      offers.filter(
                                        (o) => o.game_id === r.gameId,
                                      ),
                                    ).join(" · ") || "Plataforma sin confirmar"}
                                  </small>
                                  <small className="wishlist-mobile-meta">
                                    <OwnershipBadge value={r.ownership} />
                                  </small>
                                  <small>
                                    Hs. estimadas: {r.estimated || "—"}
                                  </small>
                                  <WishlistPrice
                                    offers={offers.filter(
                                      (o) => o.game_id === r.gameId,
                                    )}
                                  />
                                </>
                              ) : (
                                <>
                                  <small>
                                    {r.device ||
                                      r.platforms ||
                                      "Plataforma sin definir"}
                                    {view !== "library" && r.period
                                      ? " · " + r.period
                                      : ""}
                                  </small>
                                  {view !== "journal" && (
                                    <span className={"status " + r.status}>
                                      {statuses[r.status]}
                                    </span>
                                  )}
                                  {view === "library" && (
                                    <LibraryPlaythrough record={r} />
                                  )}
                                  {view === "journal" && (
                                    <small className="mobile-entry-detail">
                                      <b>Memorabilidad</b>
                                      <span>
                                        {r.memorability == null
                                          ? "—"
                                          : r.memorability + "/10"}
                                      </span>
                                    </small>
                                  )}
                                  {(view === "library" || view === "journal") &&
                                    (view === "library"
                                      ? libraryTextFields
                                      : journalTextFields
                                    ).map(({ key, label }) =>
                                      view === "library" && key === "reason" ? (
                                        <small
                                          className="mobile-entry-detail"
                                          key={key}
                                        >
                                          <LibraryFinishReason
                                            record={r}
                                            showLabel
                                          />
                                        </small>
                                      ) : r[key] ? (
                                        <small
                                          className="mobile-entry-detail"
                                          key={key}
                                        >
                                          <b>{label}</b>
                                          <span>{r[key]}</span>
                                        </small>
                                      ) : null,
                                    )}
                                </>
                              )}
                              {view !== "library" && (
                                <small className="mobile-game-hours">
                                  Hs. jugadas:{" "}
                                  {r.hours == null ? "—" : r.hours + " h"}
                                </small>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="table-scroll">
                        <table
                          className={
                            view === "upcoming"
                              ? "upcoming-table"
                              : view === "library"
                                ? "library-table"
                                : view === "wishlist"
                                  ? "wishlist-table"
                                  : undefined
                          }
                        >
                          <thead>
                            {table.getHeaderGroups().map((g) => (
                              <tr key={g.id}>
                                {g.headers.map((h) => (
                                  <th
                                    key={h.id}
                                    aria-sort={
                                      h.column.getIsSorted() === "asc"
                                        ? "ascending"
                                        : h.column.getIsSorted() === "desc"
                                          ? "descending"
                                          : "none"
                                    }
                                  >
                                    <button
                                      disabled={!h.column.getCanSort()}
                                      onClick={h.column.getToggleSortingHandler()}
                                    >
                                      {flexRender(
                                        h.column.columnDef.header,
                                        h.getContext(),
                                      )}
                                      {h.column.getCanSort() && (
                                        <ArrowUpDown size={12} />
                                      )}
                                    </button>
                                  </th>
                                ))}
                              </tr>
                            ))}
                          </thead>
                          <tbody>
                            {table.getRowModel().rows.map((r) => (
                              <tr
                                key={r.id}
                                className={entryRowClass(r.original)}
                              >
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
                {["library", "journal"].includes(view) && (
                  <section
                    className="collection-summary"
                    aria-label="Resumen filtrado"
                  >
                    <div className="stats filtered-stats">
                      <div data-stat="total">
                        <span>JUEGOS</span>
                        <strong>{summary.total}</strong>
                      </div>
                      <div
                        data-stat="started"
                        title={
                          view === "library" && selectedYear
                            ? "Con fecha de inicio en " + selectedYear
                            : "Con fecha de inicio"
                        }
                      >
                        <span>EMPECÉ</span>
                        <strong>{summary.started}</strong>
                      </div>
                      <div
                        data-stat="finished"
                        title={
                          view === "library" && selectedYear
                            ? "Con fecha de fin en " + selectedYear
                            : "Con fecha de fin"
                        }
                      >
                        <span>TERMINÉ</span>
                        <strong>{summary.finished}</strong>
                      </div>
                      <div data-stat="playing">
                        <span>JUGANDO</span>
                        <strong>{summary.playing}</strong>
                      </div>
                      <div
                        data-stat="hours"
                        title={summary.hoursCount + " con horas registradas"}
                      >
                        <span>HORAS</span>
                        <strong>
                          {summary.hours.toLocaleString("es-AR", {
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </div>
                      {view === "library" && (
                        <div
                          data-stat="rating"
                          title={summary.ratingCount + " reseñas"}
                        >
                          <span>RESEÑA MEDIA</span>
                          <strong>
                            {summary.averageRating === null
                              ? "—"
                              : summary.averageRating.toLocaleString("es-AR", {
                                  maximumFractionDigits: 1,
                                })}
                            {summary.averageRating !== null && (
                              <small>/100</small>
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                    <section
                      className="console-summary"
                      aria-label="Juegos por consola"
                    >
                      <h2>Juegos por consola</h2>
                      {summary.consoles.length ? (
                        <ul>
                          {summary.consoles.map(({ name, count }) => (
                            <li key={name}>
                              <span>{name}</span>
                              <strong>{count}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No hay juegos para estos filtros.</p>
                      )}
                    </section>
                  </section>
                )}
              </div>
              {view === "wishlist" && (
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
                        <p className="muted">Sin precio de tienda.</p>
                      )}
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
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
function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <Gamepad2 size={34} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
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
    [history, setHistory] = useState<any[] | null>(null),
    [activeTab, setActiveTab] = useState("main"),
    [pageError, setPageError] = useState(""),
    [releaseError, setReleaseError] = useState("");
  const editorId = useId();
  const formId = editorId + "-form";
  const tabs = [
    { id: "main", label: "Principal" },
    { id: "playthrough", label: "Partida" },
    { id: "review", label: "Reseña" },
    { id: "more", label: "Más" },
  ];
  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const field = (key: keyof Entry, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        id={editorId + "-" + key}
        form={formId}
        type={type}
        required={key === "title"}
        value={
          key === "started" || key === "finished"
            ? formatDate(String(draft[key] ?? ""))
            : String(draft[key] ?? "")
        }
        placeholder={
          key === "started" || key === "finished" ? "dd/mm/aaaa" : undefined
        }
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
      <div className="modal-body entry-editor">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.title.trim()) {
              setActiveTab("main");
              requestAnimationFrame(() => {
                const name = document.getElementById(
                  editorId + "-title",
                ) as HTMLInputElement | null;
                name?.focus();
                name?.reportValidity();
              });
              return;
            }
            const release = releaseSchema.safeParse(draft.release ?? "");
            if (!release.success) {
              setReleaseError(release.error.issues[0].message);
              setActiveTab("more");
              return;
            }
            setReleaseError("");
            const pages = pagesSchema.safeParse([
              ...(draft.pages ?? []),
              ...(url.trim() ? [url] : []),
            ]);
            if (!pages.success) {
              setPageError(
                pages.error.issues[0]?.message ?? "Revisá las páginas.",
              );
              setActiveTab("main");
              return;
            }
            setPageError("");
            onSave({ ...draft, pages: pages.data });
          }}
        />
        <div
          className="editor-tabs"
          role="tablist"
          aria-label="Secciones del juego"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const index = tabs.findIndex((tab) => tab.id === activeTab);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                    tabs.length;
            setActiveTab(tabs[next].id);
            document
              .getElementById(editorId + "-tab-" + tabs[next].id)
              ?.focus();
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={editorId + "-tab-" + tab.id}
              aria-controls={editorId + "-panel-" + tab.id}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-main"}
          aria-labelledby={editorId + "-tab-main"}
          hidden={activeTab !== "main"}
        >
          {activeTab === "main" && (
            <>
              {field("title", "Nombre del juego")}
              <PlatformPicker
                label="Plataformas disponibles"
                value={draft.platforms}
                onChange={(value) => set("platforms", value)}
                form={formId}
                multiple
              />
              <div className="form-grid">
                <label>
                  Estado
                  <select
                    form={formId}
                    aria-label="Estado"
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    {Object.entries(statuses).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Acceso al juego
                  <select
                    form={formId}
                    value={getOwnershipInfo(draft.ownership).value}
                    onChange={(event) => set("ownership", event.target.value)}
                  >
                    <option value="" disabled>
                      Sin definir
                    </option>
                    {draft.ownership &&
                      !ownershipOptions.some(
                        (option) =>
                          option.value ===
                          getOwnershipInfo(draft.ownership).value,
                      ) && (
                        <option value={draft.ownership}>
                          {draft.ownership} (actual)
                        </option>
                      )}
                    {ownershipOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {field("priority", "Prioridad")}
                {field("estimated", "Horas estimadas")}
              </div>
              <section className="editor-section">
                <h3>
                  Páginas <span className="muted">· opcional</span>
                </h3>
                {offers.map((offer) => (
                  <OfferEditor
                    key={offer.id}
                    offer={offer}
                    run={run}
                    showHistory={async () =>
                      setHistory(await api("/api/offers?id=" + offer.id))
                    }
                  />
                ))}
                {(draft.pages ?? []).length > 0 && (
                  <ul className="draft-pages" aria-label="Páginas del juego">
                    {draft.pages?.map((page) => (
                      <li key={page}>
                        <a
                          href={page}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {page}
                          <ExternalLink size={13} />
                        </a>
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label={"Quitar página " + page}
                          disabled={busy}
                          onClick={() =>
                            set(
                              "pages",
                              draft.pages?.filter((value) => value !== page),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const pages = pagesSchema.safeParse([
                      ...(draft.pages ?? []),
                      url,
                    ]);
                    if (!pages.success) {
                      setPageError(
                        pages.error.issues[0]?.message ?? "Revisá el enlace.",
                      );
                      return;
                    }
                    set("pages", pages.data);
                    setUrl("");
                    setPageError("");
                  }}
                >
                  <input
                    type="url"
                    aria-label="Enlace de página"
                    placeholder="https://…"
                    value={url}
                    onChange={(event) => {
                      setUrl(event.target.value);
                      setPageError("");
                    }}
                    required
                    disabled={busy}
                  />
                  <button className="secondary" disabled={busy}>
                    Agregar
                  </button>
                </form>
                {pageError && (
                  <p className="error" role="alert">
                    {pageError}
                  </p>
                )}
                <p className="fine-print">
                  Precios: Steam y Nintendo. Otras páginas: referencia.
                </p>
                {history && (
                  <div className="history">
                    {history.length ? (
                      history.map((quote) => (
                        <p key={quote.id}>
                          {formatDateTime(quote.created_at)} · {quote.currency}{" "}
                          {quote.price} · {quote.discount}% OFF
                        </p>
                      ))
                    ) : (
                      <p>Todavía no hay cambios de precio registrados.</p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-playthrough"}
          aria-labelledby={editorId + "-tab-playthrough"}
          hidden={activeTab !== "playthrough"}
        >
          {activeTab === "playthrough" && (
            <>
              <div className="form-grid">
                {field("started", "Empecé")}
                {field("finished", "Terminé")}
              </div>
              <PlatformPicker
                label="Consola donde jugué"
                value={draft.device}
                onChange={(value) => set("device", value)}
                form={formId}
              />
              <label>
                ¿Por qué? · privado
                <textarea
                  form={formId}
                  rows={3}
                  value={draft.reason}
                  onChange={(e) => set("reason", e.target.value)}
                />
              </label>
            </>
          )}
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-review"}
          aria-labelledby={editorId + "-tab-review"}
          hidden={activeTab !== "review"}
        >
          {activeTab === "review" && (
            <>
              <div className="form-grid">
                {field("rating", "Reseña / 100", "number")}
                {field("hours", "Horas jugadas", "number")}
                {field("impression", "Impresiones")}
                {field("focus", "Historia, gameplay o ambos")}
              </div>
              <label>
                Comentarios adicionales · privados
                <textarea
                  form={formId}
                  rows={5}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </label>
            </>
          )}
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-more"}
          aria-labelledby={editorId + "-tab-more"}
          hidden={activeTab !== "more"}
        >
          <ReleaseField
            record={draft}
            form={formId}
            error={releaseError}
            onChange={(release) => {
              const parsed = parseRelease(release);
              setDraft((current) => ({
                ...current,
                release,
                year: parsed.kind === "unknown" ? null : parsed.year,
              }));
              setReleaseError("");
            }}
          />
          {activeTab === "more" && (
            <>
              <div className="form-grid">
                {field("period", "Año o período jugado")}
                {field("memorability", "Memorabilidad / 10", "number")}
                {field("replay", "¿Lo rejugarías?")}
                <label>
                  Hype
                  <select
                    form={formId}
                    value={draft.hype}
                    onChange={(event) => set("hype", event.target.value)}
                  >
                    <option value="" disabled>
                      Elegí el hype…
                    </option>
                    {draft.hype &&
                      !["Bajo", "Medio", "Dunno", "Alto", "Hyper"].includes(
                        draft.hype,
                      ) && (
                        <option value={draft.hype}>
                          {draft.hype} (actual)
                        </option>
                      )}
                    {["Bajo", "Medio", "Dunno", "Alto", "Hyper"].map(
                      (level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              {entry.id && (
                <>
                  <section className="editor-section">
                    <h3>
                      <Share2 size={16} />
                      Compartir esta entrada
                    </h3>
                    <p className="muted">
                      Se comparten la partida, las horas, las puntuaciones y las
                      impresiones. Motivos y comentarios: privados.
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
                          .filter(
                            (m) => !grants.some((g) => g.recipient_id === m.id),
                          )
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
                  <div className="editor-extra-actions">
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
                  </div>
                </>
              )}
            </>
          )}
        </section>
        <div className="entry-editor-actions">
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy}
          >
            {busy ? "Guardando…" : "Guardar entrada"}
            <Check size={16} />
          </button>
        </div>
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
          ? "Última consulta: " + formatDateTime(o.checked_at)
          : "Consulta pendiente"}
        {o.last_success_at
          ? " · Último precio válido: " + formatDateTime(o.last_success_at)
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
