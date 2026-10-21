"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Modal } from "../ui/dialog";
import { createResource } from "@/lib/resource";
import { apiRequest } from "@/lib/api-client";
import { notificationPageSchema } from "@/lib/notifications/history";
import type { useJournalLocation } from "@/hooks/use-journal-location";
import type { JournalNotification } from "@/lib/contracts";
import { formatDateTime } from "@/lib/journal/view-config";
const labels = {
  discount: "Descuentos",
  target: "Debajo del Objetivo",
  release: "Lanzamientos",
  test: "Pruebas",
};
export function NotificationDrawer({
  location,
  online,
  version,
  onChanged,
}: {
  location: ReturnType<typeof useJournalLocation>;
  online: boolean;
  version: number | null;
  onChanged: () => Promise<void>;
}) {
  const {
    notificationOpen: open,
    notificationRead: read,
    notificationKind: kind,
    setNotificationOpen,
    setNotificationRead,
    setNotificationKind,
  } = location;
  const resource = useMemo(
    () =>
      createResource<ReturnType<typeof notificationPageSchema.parse> | null>(
        null,
        () =>
          apiRequest(
            "/api/notifications?" + new URLSearchParams({ read, kind }),
            "GET",
            undefined,
            notificationPageSchema,
          ),
      ),
    [read, kind],
  );
  const state = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  // A page belongs to the exact successful head response it followed.
  const [pages, setPages] = useState<{
    head: typeof state.data;
    items: JournalNotification[];
    cursor: string;
  } | null>(null);
  const currentPages = pages?.head === state.data ? pages : null;
  const cursor = currentPages?.cursor ?? state.data?.nextCursor;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setError("");
      void resource.load();
    }
  }, [open, resource, version]);
  async function next() {
    const nextCursor = cursor;
    const head = state.data;
    if (!nextCursor || !head) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(
        "/api/notifications?" +
          new URLSearchParams({ read, kind, cursor: nextCursor }),
        "GET",
        undefined,
        notificationPageSchema,
      );
      setPages((previous) => ({
        head,
        items: [
          ...(previous?.head === head ? previous.items : []),
          ...result.items,
        ],
        cursor: result.nextCursor ?? "",
      }));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mark(body: { ids: string[] } | { allBefore: string }) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/notifications", "PATCH", body);
      await Promise.all([resource.load(), onChanged()]);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items = [
    ...new Map(
      [...(state.data?.items ?? []), ...(currentPages?.items ?? [])].map(
        (item) => [item.id, item],
      ),
    ).values(),
  ];
  const safeLink = (url: string) => {
    try {
      const value = new URL(url, window.location.origin);
      return value.origin === window.location.origin
        ? value.pathname + value.search + value.hash
        : "/";
    } catch {
      return "/";
    }
  };
  return (
    <Modal
      open={open}
      title="Notificaciones"
      onClose={() => !busy && setNotificationOpen(false)}
      variant="drawer"
    >
      <div className="modal-body notification-drawer">
        <div className="notification-controls">
          <label>
            Mostrar
            <select
              value={read}
              disabled={busy}
              onChange={(event) =>
                setNotificationRead(event.target.value as typeof read)
              }
            >
              <option value="unread">Sin leer</option>
              <option value="all">Todas</option>
            </select>
          </label>
          <label>
            Tipo
            <select
              value={kind}
              disabled={busy}
              onChange={(event) =>
                setNotificationKind(event.target.value as typeof kind)
              }
            >
              <option value="">Todos</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!online && (
          <p role="status">Conectate para consultar y marcar notificaciones.</p>
        )}
        {(state.error || error) && (
          <p role="alert" className="error">
            {error || state.error}{" "}
            <button
              onClick={() => {
                setError("");
                void resource.load();
              }}
            >
              Reintentar
            </button>
          </p>
        )}
        {state.data && (
          <div className="notification-heading">
            <span>{state.data.unreadCount} sin leer en total</span>
            <button
              className="text-button"
              disabled={busy || !online || !state.data.unreadCount}
              onClick={() => void mark({ allBefore: state.data!.checkedAt })}
            >
              Marcar todas como leídas
            </button>
          </div>
        )}
        {state.status === "loading" && !state.data ? (
          <p role="status">Cargando…</p>
        ) : state.data && !items.length ? (
          <p className="muted">Sin notificaciones con estos filtros.</p>
        ) : null}
        <ol className="notification-list">
          {items.map((item) => (
            <li
              className={"notification " + (!item.read_at ? "unread" : "")}
              key={item.id}
            >
              <a href={safeLink(item.url)}>
                <strong>{item.title}</strong>
              </a>
              <p>{item.body}</p>
              <small>
                {labels[item.kind]} · {formatDateTime(item.created_at)}
              </small>
              {!item.read_at && (
                <button
                  className="text-button"
                  disabled={busy || !online}
                  onClick={() => void mark({ ids: [item.id] })}
                >
                  Marcar como leída
                </button>
              )}
            </li>
          ))}
        </ol>
        {!!cursor && (
          <button
            className="secondary"
            disabled={busy || !online}
            onClick={() => void next()}
          >
            {busy ? "Cargando…" : "Cargar más"}
          </button>
        )}
      </div>
    </Modal>
  );
}
