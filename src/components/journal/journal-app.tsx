"use client";
import type { OfferTargetUpdate } from "@/lib/offers/target-draft";
import { useNotificationNavigation } from "@/hooks/use-notification-navigation";
import { notificationHref } from "@/lib/notifications/navigation";
import { ApiRequestError } from "@/lib/api-client";
import { findDuplicates } from "@/lib/journal/duplicates";
import { DuplicateWarning } from "../games/duplicate-warning";
import { recordSchema } from "@/lib/validation";
import { recordsResponseSchema } from "@/lib/contracts";
import { apiRequest } from "@/lib/api-client";
import { importBatchSchema } from "@/lib/imports/contracts";
import { pickSpreadsheet } from "@/lib/google";
import type {
  JournalLocation,
  JournalView,
} from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { disablePush } from "@/lib/push-client";
import { releaseHasArrived } from "@/lib/releases";
import { browserClient } from "@/lib/supabase/client";
import { emptyRecord, statuses, type Status } from "@/lib/types";
import { useJournalCollection } from "@/hooks/use-journal-collection";
import { useJournalData } from "@/hooks/use-journal-data";
import { useJournalLocation } from "@/hooks/use-journal-location";
import { formatDateTime } from "@/lib/journal/view-config";
import { hasActiveDiscount } from "@/lib/offers/wishlist-display";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChartNoAxesCombined,
  Bell,
  BookOpen,
  CalendarDays,
  Download,
  Gamepad2,
  Heart,
  Library,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveResponseSchema } from "@/lib/contracts";
import { ScoringGuide } from "../settings/scoring-guide";
import { AdminInvite } from "../settings/admin-invite";
import { DriveBackupPanel } from "../settings/drive-backup-panel";
import { TrashPanel } from "../settings/trash-panel";
import { BackupStatus } from "../settings/backup-status";
import { EntryEditor } from "../games/entry-editor";
import {
  ImportReviewDialog,
  type ImportBatch,
  type ImportResolutions,
} from "../imports/import-review-dialog";
import { useJournalColumns } from "./journal-columns";
import { JournalGameTable } from "./journal-game-table";
import { JournalSummary } from "./journal-summary";
import { JournalToolbar } from "./journal-toolbar";
import { NotificationDrawer } from "../notifications/notification-drawer";
import { StatisticsPanel } from "./statistics-panel";
import { NotificationSettings } from "../settings/notification-settings";

const nav = [
  ["library", "Biblioteca", Library],
  ["journal", "Diario", BookOpen],
  ["wishlist", "Lista de deseos", Heart],
  ["upcoming", "Próximos", CalendarDays],
  ["statistics", "Estadísticas", ChartNoAxesCombined],
  ["shared", "Compartido conmigo", Users],
  ["settings", "Configuración", Settings],
] as const;
export function JournalApp({
  initialLocation,
}: { initialLocation?: JournalLocation } = {}) {
  const journalLocation = useJournalLocation(initialLocation);
  const {
    view,
    query,
    status,
    discount,
    review,
    platform,
    year: selectedYear,
    sort,
    setView,
    setSort,
  } = journalLocation;
  const {
    records,
    offers,
    loading,
    online,
    warnings,
    resourceStates,
    error,
    notice,
    busy,
    member,
    sharing,
    notifications,
    unreadCount,
    notificationsCheckedAt,
    notificationPageCheckedAt,
    notificationReadsPending,
    waitForNotificationReads,
    observeNotificationReads,
    readNotifications,
    setBusy,
    setError,
    setNotice,
    reloadJournal,
    performAction,
    removeRecord,
  } = useJournalData();
  const openNotification = useNotificationNavigation({
    location: journalLocation,
    records,
    offers,
    recordsReady: resourceStates.records.checkedAt !== null,
    online,
    readNotifications,
    setNotice,
    setError,
  });
  const [releaseNow, setReleaseNow] = useState(() => new Date());
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [undoEntry, setUndoEntry] = useState<{
    id: string;
    expires: number;
  } | null>(null);
  useEffect(() => {
    if (!undoEntry) return;
    const timeout = setTimeout(
      () => setUndoEntry(null),
      Math.max(0, undoEntry.expires - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [undoEntry]);
  const openEntry = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
  }, []);
  async function signOut() {
    try {
      await disablePush().catch(() => {});
      const result = await browserClient().auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      location.assign("/login");
    } catch {
      setError("No se pudo cerrar sesión. Conectate y volvé a intentarlo.");
    }
  }
  const [duplicate, setDuplicate] = useState<{
    candidate: JournalEntry;
    matches: JournalEntry[];
    offerTargets: OfferTargetUpdate[];
  } | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const saveInFlight = useRef(false);
  async function saveEntry(
    candidate: JournalEntry,
    allowDuplicate = false,
    offerTargets: OfferTargetUpdate[] = [],
  ) {
    if (saveInFlight.current) return false;
    if (!navigator.onLine) {
      setError("Necesitás conexión para guardar.");
      return false;
    }
    const matches = !candidate.gameId
      ? findDuplicates(candidate, records, offers)
      : [];
    if (matches.length && !allowDuplicate) {
      setDuplicate({ candidate, matches, offerTargets });
      return false;
    }
    saveInFlight.current = true;
    setSavingEntry(true);
    try {
      const saved = await performAction(async () => {
        try {
          const recordData = recordSchema.parse(candidate);
          for (const target of offerTargets)
            await apiRequest("/api/offers", "PATCH", target);
          return await apiRequest(
            "/api/records",
            "POST",
            { ...recordData, allowDuplicate },
            saveResponseSchema,
          );
        } catch (failure) {
          if (
            failure instanceof ApiRequestError &&
            failure.code === "DUPLICATE"
          ) {
            const result = recordsResponseSchema.shape.records.safeParse(
              (failure.details as { matches?: unknown })?.matches,
            );
            if (result.success)
              setDuplicate({ candidate, matches: result.data, offerTargets });
          }
          throw failure;
        }
      }, "Entrada guardada.");
      if (saved) {
        setEditingEntry(null);
        setDuplicate(null);
      }
      return saved;
    } finally {
      saveInFlight.current = false;
      setSavingEntry(false);
    }
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [resolutions, setResolutions] = useState<ImportResolutions>({});
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
  const { games, summary, platforms, yearOptions } = useJournalCollection({
    records,
    offers,
    view,
    query,
    status,
    discount,
    review,
    platform,
    selectedYear,
  });
  function entryRowClass(record: JournalEntry): string | undefined {
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
  const columns = useJournalColumns({
    view,
    offers,
    sort,
    releaseNow,
    onEdit: openEntry,
  });
  const table = useReactTable({
    data: games,
    getRowId: (entry) => entry.id ?? entry.sourceKey,
    columns,
    state: {
      sorting: sort,
      columnVisibility:
        view === "library"
          ? {
              status: false,
              finished: false,
              hours: false,
              rating: false,
              notes: false,
            }
          : view === "journal"
            ? { notes: false }
            : {},
    },
    onSortingChange: setSort,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const title = nav.find((n) => n[0] === view)?.[1] ?? "Biblioteca";
  async function importSheet() {
    setBusy(true);
    try {
      const selection = await pickSpreadsheet();
      const result = await apiRequest(
        "/api/import",
        "POST",
        selection,
        importBatchSchema,
      );
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
    setSidebarOpen(false);
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (sidebarOpen ? "open" : "")}>
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
              await signOut();
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={21} />
          </button>
          <span className="topbar-right">
            <button
              className="notification-count"
              aria-label="Ver notificaciones"
              onClick={() => journalLocation.setNotificationOpen(true)}
            >
              <Bell size={16} />
              {unreadCount ?? "?"}
            </button>
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
            {!["shared", "settings", "statistics"].includes(view) && (
              <button
                className="primary"
                onClick={() =>
                  openEntry({
                    ...emptyRecord,
                    status: "wishlist",
                  })
                }
              >
                <Plus size={17} />
                Agregar juego
              </button>
            )}
          </div>
          {!online && (
            <div className="banner" role="status">
              Sin conexión. Los precios pueden estar desactualizados.
            </div>
          )}
          {online &&
            warnings.map((warning) => (
              <div className="banner error" role="alert" key={warning.name}>
                {
                  (
                    {
                      records: "Juegos",
                      offers: "Precios",
                      sharing: "Compartidos",
                      notifications: "Notificaciones",
                    } as Record<string, string>
                  )[warning.name]
                }
                : {warning.message}{" "}
                {warning.stale && "Se conserva la última versión."}
                <button onClick={() => void reloadJournal()}>Reintentar</button>
              </div>
            ))}
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
          {undoEntry && (
            <div className="banner" role="status">
              Entrada en Papelera.
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await performAction(
                      () =>
                        apiRequest("/api/trash", "PATCH", { id: undoEntry.id }),
                      "Entrada restaurada.",
                    )
                  )
                    setUndoEntry(null);
                }}
              >
                Deshacer
              </button>
            </div>
          )}
          {online && (
            <>
              <BackupStatus details={view === "settings"} />
              <DriveBackupPanel details={view === "settings"} />
            </>
          )}
          {view === "settings" ? (
            <section className="settings-grid">
              <article className="panel">
                <ScoringGuide />
              </article>
              <TrashPanel
                onChanged={async () => {
                  setUndoEntry(null);
                  await reloadJournal();
                }}
              />
              <article className="panel">
                <h2>Datos</h2>
                <p>Revisá los cambios antes de importar.</p>
                <button
                  className="primary"
                  disabled={busy || !online}
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
                <NotificationSettings onChanged={reloadJournal} />
              </article>
              {member?.role === "admin" && (
                <article className="panel">
                  <h2>Invitaciones privadas</h2>
                  <p>Acceso solo por invitación.</p>
                  <AdminInvite onError={setError} />
                </article>
              )}
              <article className="panel">
                <div className="notification-heading">
                  <h2>Últimas novedades</h2>
                  {notifications.some((n) => !n.read_at) && (
                    <button
                      className="text-button"
                      disabled={
                        notificationReadsPending ||
                        !online ||
                        !notificationPageCheckedAt
                      }
                      onClick={() =>
                        void readNotifications(
                          { allBefore: notificationPageCheckedAt },
                          unreadCount ?? 0,
                        ).catch(() => undefined)
                      }
                    >
                      Marcar como leídas
                    </button>
                  )}
                </div>
                {notifications.length ? (
                  notifications.slice(0, 10).map((n) => (
                    <div className="notification" key={n.id}>
                      <a
                        className="notification-link"
                        href={notificationHref(n)}
                        onClick={(event) => {
                          if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return;
                          event.preventDefault();
                          openNotification(n);
                        }}
                      >
                        <strong>{n.title}</strong>
                        <p>{n.body}</p>
                        <small>{formatDateTime(n.created_at)}</small>
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    {resourceStates.notifications.error
                      ? "No se pudieron cargar las alertas."
                      : "Sin alertas."}
                  </p>
                )}
              </article>
            </section>
          ) : view === "statistics" ? (
            <StatisticsPanel records={records} location={journalLocation} />
          ) : view === "shared" ? (
            <section className="panel">
              {sharing.shared.length ? (
                sharing.shared.map((r) => (
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
                  title={
                    resourceStates.sharing.error
                      ? "No se pudieron cargar los compartidos"
                      : "Sin juegos compartidos"
                  }
                />
              )}
            </section>
          ) : (
            <>
              <JournalToolbar
                location={journalLocation}
                platforms={platforms}
                yearOptions={yearOptions}
                busy={busy}
                onRefresh={() =>
                  performAction(
                    () => apiRequest("/api/refresh", "POST", {}),
                    "Precios consultados.",
                  )
                }
              />
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
                      title={
                        resourceStates.records.error && !records.length
                          ? "No se pudieron cargar los juegos"
                          : "No hay juegos"
                      }
                      text={
                        resourceStates.records.error && !records.length
                          ? "Reintentá la carga cuando vuelva la conexión."
                          : records.length
                            ? "Cambiá los filtros o agregá un juego."
                            : "Agregá un juego o importá desde Configuración."
                      }
                    />
                  ) : (
                    <JournalGameTable
                      table={table}
                      view={view}
                      offers={offers}
                      releaseNow={releaseNow}
                      onEdit={openEntry}
                      entryRowClass={entryRowClass}
                      focusedEntry={journalLocation.focusedEntry}
                    />
                  )}
                </section>
                {["library", "journal"].includes(view) && (
                  <JournalSummary
                    summary={summary}
                    view={view}
                    selectedYear={selectedYear}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <NotificationDrawer
        location={journalLocation}
        online={online}
        version={notificationsCheckedAt}
        readNotifications={readNotifications}
        waitForNotificationReads={waitForNotificationReads}
        observeNotificationReads={observeNotificationReads}
        readsPending={notificationReadsPending}
        onOpenNotification={openNotification}
      />
      {editingEntry && (
        <EntryEditor
          key={editingEntry.id ?? "new"}
          entry={editingEntry}
          saving={savingEntry}
          actionError={error}
          offers={offers.filter((o) => o.game_id === editingEntry.gameId)}
          members={sharing.members}
          grants={sharing.grants.filter((g) => g.entry_id === editingEntry.id)}
          busy={busy}
          online={online}
          onClose={() => setEditingEntry(null)}
          onSave={async (entry, targets) => {
            await saveEntry(entry, false, targets);
          }}
          onDelete={async () => {
            if (!online) {
              setError("Eliminar requiere conexión.");
              return false;
            }
            const removed = await performAction(async () => {
              await apiRequest("/api/records", "DELETE", {
                id: editingEntry.id,
                expected: editingEntry.updated_at,
              });
              removeRecord(editingEntry.id!);
            }, "Entrada movida a Papelera.");
            if (removed) {
              setUndoEntry({
                id: editingEntry.id!,
                expires: Date.now() + 10000,
              });
              setEditingEntry(null);
            }
            return removed;
          }}
          runAction={performAction}
        />
      )}
      {duplicate && (
        <DuplicateWarning
          editing={!!duplicate.candidate.id}
          matches={duplicate.matches}
          busy={busy}
          onClose={() => setDuplicate(null)}
          onOpen={(record) => {
            setDuplicate(null);
            setEditingEntry(record);
          }}
          onReplay={(record) =>
            void saveEntry(
              {
                ...duplicate.candidate,
                id: undefined,
                gameId: record.gameId,
                updated_at: undefined,
              },
              true,
              duplicate.offerTargets,
            )
          }
          onConfirm={() =>
            void saveEntry(duplicate.candidate, true, duplicate.offerTargets)
          }
        />
      )}
      {batch && (
        <ImportReviewDialog
          batch={batch}
          resolutions={resolutions}
          setResolutions={setResolutions}
          busy={busy}
          performAction={performAction}
          onClose={() => setBatch(null)}
        />
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
