"use client";
import { SettingsScreen } from "@/features/settings/settings-screen";
import {
  SuggestionsPanel,
  SuggestionsPanelHeader,
} from "@/features/suggestions/suggestions-panel";
import { SharedGames } from "@/features/shared/shared-games";
import { QuickEditor } from "./mobile/quick-editor";
import { GlobalSearch } from "@/features/search/global-search";
import { entryDestination } from "@/lib/journal/entry-destination";
import { useInlineEditing } from "./use-inline-editing";
import { InlineEditBar } from "./inline/inline-edit-bar";
import type { OfferTargetUpdate } from "@/features/stores/target-draft";
import { useNotificationNavigation } from "@/features/notifications/use-notification-navigation";
import { ApiRequestError } from "@/lib/api-client";
import { findDuplicates } from "@/lib/journal/duplicates";
import { DuplicateWarning } from "@/features/entries/duplicate-warning";
import { recordSchema } from "@/lib/validation";
import { recordsResponseSchema } from "@/lib/contracts";
import { apiRequest } from "@/lib/api-client";
import { importBatchSchema } from "@/features/imports/contracts";
import { pickSpreadsheet } from "@/features/imports/google";
import type {
  JournalLocation,
  JournalView,
} from "@/lib/journal/journal-location";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { disablePush } from "@/features/notifications/push-client";
import { releaseHasArrived } from "@/lib/releases";
import { UpcomingScreen, UpcomingScreenHeader } from "@/features/upcoming/upcoming-screen";
import { browserClient } from "@/lib/supabase/client";
import { emptyRecord } from "@/lib/types";
import { useJournalCollection } from "./use-journal-collection";
import { useJournalData } from "./use-journal-data";
import { useJournalLocation } from "./use-journal-location";
import { hasActiveDiscount } from "@/features/wishlist/wishlist-display";
import { WishlistScreen, WishlistScreenHeader } from "@/features/wishlist/wishlist-screen";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Compass,
  ChartNoAxesCombined,
  Bell,
  CalendarDays,
  Heart,
  Library,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveResponseSchema } from "@/lib/contracts";
import { DriveBackupPanel } from "@/features/settings/drive-backup-panel";
import { BackupStatus } from "@/features/settings/backup-status";
import { EntryEditor } from "@/features/entries/entry-editor";
import {
  ImportReviewDialog,
  type ImportBatch,
  type ImportResolutions,
} from "@/features/imports/import-review-dialog";
import { useJournalColumns } from "./journal-columns";
import {
  CollectionEmptyState,
  JournalCollectionSummary,
} from "./journal-collection-panel";
import { JournalToolbar } from "./journal-toolbar";
import { HistoryScreen, HistoryScreenHeader } from "@/features/library/history/history-screen";
import { LibraryScreen, LibraryScreenHeader } from "@/features/library/library-screen";
import { LibrarySectionNav } from "@/features/library/library-section-nav";
import { Notebook } from "@/features/notebook/notebook-panel";
import { NotificationDrawer } from "@/features/notifications/notification-drawer";
import {
  StatisticsPanel,
  StatisticsPanelHeader,
} from "@/features/statistics/statistics-panel";
import { SeriesManager } from "@/features/library/series/series-manager";
import "@/features/library/notebook-library.css";
import "./notebook-theme.css";

const nav = [
  ["library", "Biblioteca", Library],
  ["wishlist", "Lista de deseos", Heart],
  ["upcoming", "Próximos", CalendarDays],
  ["suggestions", "¿Qué juego ahora?", Compass],
  ["statistics", "Estadísticas", ChartNoAxesCombined],
  ["shared", "Compartido conmigo", Users],
  ["settings", "Configuración", Settings],
] as const;
export function JournalApp({
  initialLocation,
}: { initialLocation?: JournalLocation } = {}) {
  const detailNavigationGuard = useRef<() => boolean>(() => true);
  const canRestoreLocation = useCallback(() => detailNavigationGuard.current(), []);
  const journalLocation = useJournalLocation(initialLocation, canRestoreLocation);
  const {
    view,
    query,
    status,
    discount,
    access,
    review,
    platform,
    year: selectedYear,
    sort,
    setView,
    setSort,
  } = journalLocation;
  const librarySection = journalLocation.librarySection;
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
    acceptRecord,
    reloadRecords,
    getRecord,
  } = useJournalData();
  const inlineEditing = useInlineEditing({
    records,
    online,
    blocked: busy,
    acceptRecord,
  });
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
  const detailEntryId = journalLocation.detailEntry;
  const detailEntry = view === "library" && detailEntryId ? getRecord(detailEntryId) : undefined;
  const setDetailEntryId = journalLocation.setDetailEntry;
  const [detailDraftDirty, setDetailDraftDirty] = useState(false);
  const [detailEditorRevision, setDetailEditorRevision] = useState(0);
  const detailBackRequest = useRef<(() => void) | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const refreshInFlight = useRef(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editingDraft, setEditingDraft] = useState<JournalEntry | undefined>(
    undefined,
  );
  const [quickEntry, setQuickEntry] = useState<JournalEntry | null>(null);
  const restoreNotebookEditorFocus = useRef(false);
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
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice, setNotice]);
  const openEntry = useCallback((entry: JournalEntry) => {
    if (!detailNavigationGuard.current()) return;
    setDetailEntryId("");
    setDetailDraftDirty(false);
    restoreNotebookEditorFocus.current = false;
    setEditingDraft(undefined);
    setEditingEntry(entry);
  }, []);
  function addEntry() {
    openEntry({ ...emptyRecord, status: "wishlist" });
  }
  function openLibraryListEntry(entry: JournalEntry) {
    if (inlineEditing.dirty || inlineEditing.saving || busy || savingEntry) {
      setNotice("Guardá o cancelá la edición actual antes de abrir otra.");
      return;
    }
    const current = getRecord(entry.id ?? "");
    if (!current) {
      setNotice("La partida ya no está disponible.");
      return;
    }
    inlineEditing.cancel();
    const id = current.id ?? current.sourceKey;
    setDetailEntryId(id);
    setDetailDraftDirty(false);
    setEditingDraft(undefined);
    setEditingEntry(null);
  }
  function closeLibraryDetail() {
    const returnId = detailEntryId;
    setDetailEntryId("");
    setDetailDraftDirty(false);
    requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-entry-id]"))
        .find((node) => node.dataset.entryId === returnId && node.getClientRects().length > 0);
      const button = row?.querySelector<HTMLButtonElement>(".inline-details, [data-quick-edit-id]");
      const target = button ?? row;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center", behavior: "instant" });
      } else {
        const heading = document.querySelector<HTMLElement>(".notebook-library-heading h1");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
    });
  }
  async function signOut() {
    if (detailDraftDirty || inlineEditing.dirty || inlineEditing.saving) {
      setNotice("Guardá o cancelá la edición antes de cerrar sesión.");
      return;
    }
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
  useEffect(() => {
    if (detailEntryId && !detailEntry && !loading && resourceStates.records.checkedAt && !resourceStates.records.error) {
      setDetailEntryId("");
      setDetailDraftDirty(false);
      setNotice("La partida ya no está disponible.");
    }
  }, [detailEntryId, detailEntry, loading, resourceStates.records.checkedAt, resourceStates.records.error, setDetailEntryId, setNotice]);
  detailNavigationGuard.current = () => {
    if (detailEntryId && (detailDraftDirty || inlineEditing.dirty || inlineEditing.saving || savingEntry)) {
      setNotice("Guardá o cancelá la edición antes de salir de la ficha.");
      return false;
    }
    return true;
  };
  async function appendNotebookNote(id: string, text: string) {
    const entry = getRecord(id);
    if (!entry?.updated_at || entry.status !== "playing")
      throw Error("Esta partida ya no está en curso.");
    if (!navigator.onLine)
      throw Error("Necesitás conexión para guardar.");
    if (
      busy ||
      savingEntry ||
      inlineEditing.saving ||
      (detailDraftDirty && detailEntryId === id) ||
      (inlineEditing.dirty && inlineEditing.active?.entry.id === id)
    )
      throw Error(
        "Guardá o cancelá la edición actual antes de agregar la nota.",
      );

    const reminder = entry.reminder ? `${entry.reminder}\n\n${text}` : text;
    const candidate = recordSchema.safeParse({ ...entry, reminder });
    if (!candidate.success) {
      if (candidate.error.issues.some((issue) => issue.path[0] === "reminder"))
        throw Error(
          "El recordatorio admite hasta 5.000 caracteres. Acortá el texto.",
        );
      throw Error("No se pudo guardar la nota en esta partida.");
    }
    try {
      const { record } = await apiRequest(
        "/api/records",
        "POST",
        candidate.data,
        saveResponseSchema,
      );
      if (record?.id !== id || !record.updated_at || record.reminder !== reminder)
        throw new ApiRequestError(
          "No se pudo confirmar la nota. Volvé a intentarlo.",
          200,
          "INVALID_RESPONSE",
        );
      acceptRecord(record);
    } catch (failure) {
      if (failure instanceof ApiRequestError) {
        if (["CONFLICT", "NETWORK", "INVALID_RESPONSE"].includes(failure.code)) {
          await reloadRecords();
          if (getRecord(id)?.reminder === reminder) return;
        }
        if (failure.code === "CONFLICT")
          throw Error(
            "La partida cambió. Revisá la selección y volvé a intentarlo.",
            { cause: failure },
          );
      }
      throw failure;
    }
  }
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
        restoreNotebookEditorFocus.current = false;
        if (!detailEntryId) setEditingEntry(null);
        else {
          setDetailDraftDirty(false);
          setDetailEditorRevision((revision) => revision + 1);
        }
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
    if (view !== "upcoming" && view !== "suggestions") return;
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
    access,
    review,
    platform,
    scale: journalLocation.scale,
    selectedYear,
  });
  function entryRowClass(record: JournalEntry): string | undefined {
    if (view === "library" && record.status === "playing")
      return "library-playing";
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
    refreshing: refreshingPrices,
    onEdit: (entry) => {
      if (view === "library") openLibraryListEntry(entry);
      else openEntry(entry);
    },
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
    if (!detailNavigationGuard.current()) return;
    if (v === "library") journalLocation.setLibrarySection("games");
    else setView(v);
    setSidebarOpen(false);
  }
  const seriesActive = view === "library" && librarySection === "series";
  const collection = {
    loading,
    resultsCount: games.length,
    hasRecords: records.length > 0,
    recordsError: !!resourceStates.records.error,
    inlineEditing:
      detailEntryId && detailDraftDirty
        ? { ...inlineEditing, canEdit: false }
        : inlineEditing,
    tableProps: {
      table,
      offers,
      releaseNow,
      refreshing: refreshingPrices,
      entryRowClass,
      focusedEntry: journalLocation.focusedEntry,
      onQuickEdit: (entry: JournalEntry) => {
        if (inlineEditing.dirty || inlineEditing.saving || busy || savingEntry) {
          setNotice(
            "Guardá o cancelá la edición actual antes de abrir otra.",
          );
          return;
        }
        inlineEditing.cancel();
        if (view === "library") {
          openLibraryListEntry(entry);
          return;
        }
        setQuickEntry({ ...entry });
      },
    },
  };
  return (
    <div
      className={
        "app-shell notebook-app" +
        (["library", "journal"].includes(view) ? " notebook-library" : "")
      }
    >
      <aside
        id="journal-full-navigation"
        className={"sidebar " + (sidebarOpen ? "open" : "")}
      >
        <a href="/" className="brand">
          <span className="brand-icon">gj.</span>
          <span>Game Journal</span>
        </a>
        <button
          type="button"
          className="notebook-menu-close"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <nav aria-label="Navegación principal">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => switchView(key)}
              className={
                (key === "library" && ["library", "journal"].includes(view)) ||
                view === key
                  ? "active"
                  : ""
              }
              aria-current={
                (key === "library" && ["library", "journal"].includes(view)) ||
                view === key
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} />
              {label}
              {key === "wishlist" && (
                <span className="nav-count" title="Juegos en descuento">
                  {
                    records.filter(
                      (record) =>
                        record.status === "wishlist" &&
                        !!record.gameId &&
                        hasActiveDiscount(
                          offers.filter(
                            (offer) => offer.game_id === record.gameId,
                          ),
                        ),
                    ).length
                  }
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
      {sidebarOpen && (
        <button
          type="button"
          className="notebook-menu-scrim"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <nav className="notebook-bottom-nav" aria-label="Navegación móvil">
        <button
          type="button"
          aria-current={
            ["library", "journal"].includes(view) ? "page" : undefined
          }
          onClick={() => switchView("library")}
        >
          <Library size={20} aria-hidden="true" />
          <span>Biblioteca</span>
        </button>
        <button
          type="button"
          aria-current={view === "wishlist" ? "page" : undefined}
          onClick={() => switchView("wishlist")}
        >
          <Heart size={20} aria-hidden="true" />
          <span>Deseos</span>
        </button>
        <button
          type="button"
          aria-current={view === "upcoming" ? "page" : undefined}
          onClick={() => switchView("upcoming")}
        >
          <CalendarDays size={20} aria-hidden="true" />
          <span>Próximos</span>
        </button>
        <button
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="journal-full-navigation"
          aria-current={
            ["library", "journal", "wishlist", "upcoming"].includes(view)
              ? undefined
              : "page"
          }
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <Menu size={20} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            aria-controls="journal-full-navigation"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={21} />
          </button>
          <GlobalSearch
            records={records}
            offers={offers}
            state={resourceStates.records}
            online={online}
            blocked={
              busy ||
              savingEntry ||
              inlineEditing.saving ||
              !!editingEntry || !!detailEntryId ||
              !!quickEntry ||
              !!batch ||
              !!duplicate ||
              journalLocation.notificationOpen
            }
            dirty={inlineEditing.dirty}
            saveError={inlineEditing.error}
            onRetry={() => void reloadRecords()}
            onChoose={async (entry, decision) => {
              if (!entry.id || !getRecord(entry.id)) {
                setNotice("La partida ya no está disponible.");
                return false;
              }
              if (inlineEditing.dirty) {
                if (decision === "save") {
                  if (!(await inlineEditing.save())) return false;
                } else if (decision === "discard") inlineEditing.cancel();
                else return false;
              } else inlineEditing.cancel();
              const current = getRecord(entry.id);
              if (!current) {
                setNotice("La partida ya no está disponible.");
                return false;
              }
              const destination = entryDestination(current);
              journalLocation.revealEntry(
                destination.view,
                destination.entryId,
              );
              setSidebarOpen(false);
              return true;
            }}
          />
          <span className="topbar-right">
            <Notebook records={records} onAppendToGame={appendNotebookNote} />
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
          {["library", "journal"].includes(view) && (
            <LibrarySectionNav
              current={view === "journal" ? "history" : librarySection}
              onNavigate={(section) => {
                if (section === "history") setView("journal");
                else journalLocation.setLibrarySection(section);
              }}
            />
          )}
          {view === "library" ? (
            librarySection === "games" ? (
              <LibraryScreenHeader
                location={journalLocation}
                platforms={platforms}
                yearOptions={yearOptions}
                resultsCount={games.length}
                onAdd={addEntry}
              />
            ) : null
          ) : view === "journal" ? (
            <HistoryScreenHeader
              selectedYear={selectedYear}
              resultsCount={games.length}
              onAdd={addEntry}
            />
          ) : view === "wishlist" ? (
            <WishlistScreenHeader
              resultsCount={games.length}
              onAdd={addEntry}
            />
          ) : view === "upcoming" ? (
            <UpcomingScreenHeader
              resultsCount={games.length}
              onAdd={addEntry}
            />
          ) : view === "suggestions" ? (
            <SuggestionsPanelHeader />
          ) : view === "statistics" ? (
            <StatisticsPanelHeader />
          ) : (
            <div className="page-heading">
              <div>
                <h1>
                  {title}
                  {!title.endsWith("?") && <span className="accent">.</span>}
                </h1>
              </div>
              {!["shared", "settings", "statistics", "suggestions"].includes(
                view,
              ) && (
                <button
                  className="primary"
                  onClick={addEntry}
                >
                  <Plus size={17} />
                  Agregar juego
                </button>
              )}
            </div>
          )}
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
                        apiRequest("/api/trash", "PATCH", {
                          id: undoEntry.id,
                        }),
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
          {online && view !== "settings" && (
            <>
              <BackupStatus details={false} />
              <DriveBackupPanel details={false} />
            </>
          )}
          <div className="series-page-panel" hidden={!seriesActive}>
            <SeriesManager
              active={seriesActive}
              records={records}
              ready={
                resourceStates.records.checkedAt !== null &&
                !resourceStates.records.error
              }
              disabled={busy || inlineEditing.dirty || inlineEditing.saving}
            />
          </div>
          {seriesActive ? null : view === "settings" ? (
            <SettingsScreen
              online={online}
              isAdmin={member?.role === "admin"}
              onNotificationSettingsChanged={reloadJournal}
              onTrashChanged={async () => {
                setUndoEntry(null);
                await reloadJournal();
              }}
              onInviteError={setError}
              dataChecks={{
                records,
                recordsReady: resourceStates.records.checkedAt !== null,
                recordsError: !!resourceStates.records.error,
                blocked:
                  busy ||
                  savingEntry ||
                  inlineEditing.saving ||
                  inlineEditing.dirty,
                dirty: inlineEditing.dirty,
                location: journalLocation,
                onReload: () => void reloadRecords(),
                onView: (entry) => {
                  if (
                    inlineEditing.dirty ||
                    inlineEditing.saving ||
                    busy ||
                    savingEntry
                  )
                    return;
                  const current = getRecord(entry.id ?? "");
                  if (!current) {
                    setNotice("La partida ya no está disponible.");
                    return;
                  }
                  inlineEditing.cancel();
                  const destination = entryDestination(current);
                  journalLocation.revealEntry(
                    destination.view,
                    destination.entryId,
                  );
                },
                onEdit: (entry) => {
                  if (
                    inlineEditing.dirty ||
                    inlineEditing.saving ||
                    busy ||
                    savingEntry
                  )
                    return;
                  const current = getRecord(entry.id ?? "");
                  if (!current) {
                    setNotice("La partida ya no está disponible.");
                    return;
                  }
                  inlineEditing.cancel();
                  openEntry({ ...current });
                },
              }}
              importExport={{
                importDisabled: busy || !online,
                onImport: importSheet,
              }}
              recentNotifications={{
                notifications,
                loadError: !!resourceStates.notifications.error,
                markReadDisabled:
                  notificationReadsPending ||
                  !online ||
                  !notificationPageCheckedAt,
                onMarkRead: () =>
                  void readNotifications(
                    { allBefore: notificationPageCheckedAt },
                    unreadCount ?? 0,
                  ).catch(() => undefined),
                onOpenNotification: openNotification,
              }}
            />
          ) : view === "suggestions" ? (
            <SuggestionsPanel
              records={records}
              offers={offers}
              now={releaseNow}
              location={journalLocation}
              ready={resourceStates.records.checkedAt !== null}
              loadError={!!resourceStates.records.error}
              online={online}
              blocked={
                busy ||
                savingEntry ||
                inlineEditing.saving ||
                inlineEditing.dirty
              }
              dirty={inlineEditing.dirty}
              onRetry={() => void reloadRecords()}
              onView={(entry) => {
                if (inlineEditing.dirty || inlineEditing.saving) return;
                const current = getRecord(entry.id ?? "");
                if (!current) {
                  setNotice("La partida ya no está disponible.");
                  return;
                }
                inlineEditing.cancel();
                const destination = entryDestination(current);
                journalLocation.revealEntry(
                  destination.view,
                  destination.entryId,
                );
              }}
              onStart={async (entry) => {
                if (
                  inlineEditing.dirty ||
                  inlineEditing.saving ||
                  busy ||
                  savingEntry
                )
                  return;
                inlineEditing.cancel();
                const saved = await inlineEditing.saveDraft(
                  entry,
                  { ...entry, status: "playing" },
                  entry.status === "paused" ? "Retomar juego" : "Empezar juego",
                );
                if (saved?.id) journalLocation.revealEntry("library", saved.id);
              }}
            />
          ) : view === "statistics" ? (
            <StatisticsPanel
              records={records}
              location={journalLocation}
              recordsReady={resourceStates.records.checkedAt !== null}
              recordsError={!!resourceStates.records.error}
            />
          ) : view === "shared" ? (
            <SharedGames
              games={sharing.shared}
              emptyState={
                <CollectionEmptyState
                  title={
                    resourceStates.sharing.error
                      ? "No se pudieron cargar los compartidos"
                      : "Sin juegos compartidos"
                  }
                />
              }
            />
          ) : (
            <>
              {view === "library" ? (
                <LibraryScreen
                  collection={collection}
                  detailEntryId={detailEntryId}
                  detail={
                    detailEntry
                      ? {
                          entry: detailEntry,
                          revision: detailEditorRevision,
                          saving: savingEntry || inlineEditing.saving,
                          actionError: error,
                          offers: offers.filter((o) => o.game_id === detailEntry.gameId),
                          members: sharing.members,
                          grants: sharing.grants.filter((g) => g.entry_id === detailEntry.id),
                          busy,
                          online,
                          inlineBlocked: inlineEditing.dirty || inlineEditing.saving,
                          onDirtyChange: setDetailDraftDirty,
                          backRequestRef: detailBackRequest,
                          onClose: closeLibraryDetail,
                          onSave: async (entry, targets) => {
                            await saveEntry(entry, false, targets);
                          },
                          onDelete: async () => {
                            if (!online) {
                              setError("Eliminar requiere conexión.");
                              return false;
                            }
                            const current = getRecord(detailEntryId) ?? detailEntry;
                            const removed = await performAction(async () => {
                              await apiRequest("/api/records", "DELETE", {
                                id: current.id,
                                expected: current.updated_at,
                              });
                              removeRecord(current.id!);
                            }, "Entrada movida a Papelera.");
                            if (removed) {
                              setUndoEntry({
                                id: current.id!,
                                expires: Date.now() + 10000,
                              });
                              setEditingEntry(null);
                              setDetailEntryId("");
                            }
                            return removed;
                          },
                          runAction: performAction,
                        }
                      : undefined
                  }
                />
              ) : (
                <>
                  <JournalToolbar
                    location={journalLocation}
                    platforms={platforms}
                    yearOptions={yearOptions}
                    busy={busy}
                    refreshing={refreshingPrices}
                    onRefresh={async () => {
                      if (busy || refreshInFlight.current) return;
                      refreshInFlight.current = true;
                      setRefreshingPrices(true);
                      try {
                        await performAction(
                          () => apiRequest("/api/refresh", "POST", {}),
                          "Precios consultados.",
                        );
                      } finally {
                        refreshInFlight.current = false;
                        setRefreshingPrices(false);
                      }
                    }}
                  />
                  {view === "journal" ? (
                    <HistoryScreen collection={collection} />
                  ) : view === "wishlist" ? (
                    <WishlistScreen collection={collection} />
                  ) : (
                    <UpcomingScreen collection={collection} />
                  )}
                </>
              )}
              {["library", "journal"].includes(view) && (
                <JournalCollectionSummary
                  summary={summary}
                  view={view}
                  selectedYear={selectedYear}
                />
              )}
            </>
          )}
        </div>
      </main>
      <InlineEditBar
        edit={inlineEditing}
        onReturn={() => {
          if (inlineEditing.active)
            journalLocation.revealEntry(
              inlineEditing.active.view,
              inlineEditing.active.entry.id ?? "",
            );
        }}
      />
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
      {quickEntry && (
        <QuickEditor
          key={quickEntry.id}
          entry={quickEntry}
          online={online}
          saving={inlineEditing.saving}
          actionError={inlineEditing.error}
          onClose={() => setQuickEntry(null)}
          onSave={async (base, draft) =>
            !!(await inlineEditing.saveDraft(base, draft, "Edición rápida"))
          }
          onFull={(base, draft) => {
            inlineEditing.cancel();
            setEditingEntry(base);
            setEditingDraft(draft);
            setQuickEntry(null);
          }}
          onRestoreFocus={() => {
            const button = Array.from(
              document.querySelectorAll<HTMLButtonElement>(
                "[data-quick-edit-id]",
              ),
            ).find(
              (node) =>
                node.dataset.quickEditId === quickEntry.id &&
                node.getClientRects().length > 0,
            );
            (
              button ??
              document.querySelector<HTMLButtonElement>(
                ".global-search-trigger",
              )
            )?.focus({ preventScroll: true });
          }}
        />
      )}
      {editingEntry && !detailEntryId && (
        <EntryEditor
          key={editingEntry.id ?? "new"}
          entry={editingEntry}
          initialDraft={editingDraft}
          saving={savingEntry || inlineEditing.saving}
          actionError={error}
          offers={offers.filter((o) => o.game_id === editingEntry.gameId)}
          members={sharing.members}
          grants={sharing.grants.filter((g) => g.entry_id === editingEntry.id)}
          busy={busy}
          online={online}
          onClose={() => {
            const restoreId = restoreNotebookEditorFocus.current
              ? editingEntry.id
              : undefined;
            restoreNotebookEditorFocus.current = false;
            setEditingEntry(null);
            if (restoreId)
              requestAnimationFrame(() => {
                const button = Array.from(
                  document.querySelectorAll<HTMLButtonElement>(
                    "[data-notebook-full-edit-id]",
                  ),
                ).find(
                  (node) =>
                    node.dataset.notebookFullEditId === restoreId &&
                    node.getClientRects().length > 0,
                );
                button?.focus({ preventScroll: true });
              });
          }}
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
          view={view}
          onReleaseFound={async (release) => {
            if (view !== "upcoming" || editingEntry.status !== "upcoming")
              return null;
            const saved = await inlineEditing.saveDraft(
              editingEntry,
              { ...editingEntry, ...release },
              "Fecha de lanzamiento",
            );
            if (saved)
              setEditingEntry((current) =>
                current &&
                current.id === editingEntry.id &&
                current.updated_at === editingEntry.updated_at
                  ? saved
                  : current,
              );
            return saved;
          }}
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
