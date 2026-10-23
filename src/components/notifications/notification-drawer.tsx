"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { notificationHref } from "@/lib/notifications/navigation";
import { Modal } from "../ui/dialog";
import { createResource } from "@/lib/resource";
import { apiRequest } from "@/lib/api-client";
import {
  optimisticNotificationRead,
  type NotificationReadInput,
  type ObserveNotificationReads,
} from "@/lib/notifications/read-state";
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
  readNotifications,
  waitForNotificationReads,
  observeNotificationReads,
  readsPending,
  onOpenNotification,
}: {
  location: ReturnType<typeof useJournalLocation>;
  online: boolean;
  version: number | null;
  readNotifications: (
    input: NotificationReadInput,
    unreadDelta: number,
  ) => Promise<void>;
  waitForNotificationReads: () => Promise<void>;
  observeNotificationReads: ObserveNotificationReads;
  readsPending: boolean;
  onOpenNotification: (notification: JournalNotification) => void;
}) {
  const navigating = useRef(false);
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
        async () => {
          await waitForNotificationReads();
          return apiRequest(
            "/api/notifications?" + new URLSearchParams({ read, kind }),
            "GET",
            undefined,
            notificationPageSchema,
          );
        },
      ),
    [read, kind, waitForNotificationReads],
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
      navigating.current = false;
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
  useEffect(
    () =>
      observeNotificationReads((body, unreadDelta) => {
        const head = resource.getSnapshot().data;
        if (!head) return null;
        setError("");
        const loaded = [...head.items, ...(currentPages?.items ?? [])];
        const update = optimisticNotificationRead(
          { ...head, items: loaded },
          body,
          unreadDelta,
        );
        const marked = new Map(
          update.data.items.map((item) => [item.id, item]),
        );
        const nextHead = {
          ...update.data,
          items: head.items.map((item) => marked.get(item.id) ?? item),
        };
        resource.setData(nextHead);
        setPages((previous) =>
          previous?.head === head
            ? {
                ...previous,
                head: nextHead,
                items: previous.items.map(
                  (item) => marked.get(item.id) ?? item,
                ),
              }
            : previous,
        );
        return {
          rollback() {
            const current = resource.getSnapshot().data;
            if (!current) return;
            const restored = update.rollback(current);
            resource.setData(restored);
            setPages((previous) =>
              previous?.head === current
                ? {
                    ...previous,
                    head: restored,
                    items: update.rollback({
                      ...current,
                      items: previous.items,
                    }).items,
                  }
                : previous,
            );
          },
          refresh: resource.invalidate,
        };
      }),
    [observeNotificationReads, resource, currentPages],
  );
  async function mark(body: NotificationReadInput) {
    const head = resource.getSnapshot().data;
    if (!head) return;
    setError("");
    const loaded = [...head.items, ...(currentPages?.items ?? [])];
    const unreadDelta =
      "allBefore" in body
        ? head.unreadCount
        : new Set(
            body.ids.filter((id) =>
              loaded.some((item) => item.id === id && !item.read_at),
            ),
          ).size;
    try {
      await readNotifications(body, unreadDelta);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo marcar la notificación como leída.",
      );
    }
  }
  const items = [
    ...new Map(
      [...(state.data?.items ?? []), ...(currentPages?.items ?? [])].map(
        (item) => [item.id, item],
      ),
    ).values(),
  ].filter((item) => read === "all" || !item.read_at);
  return (
    <Modal
      open={open}
      title="Notificaciones"
      onClose={() => setNotificationOpen(false)}
      variant="drawer"
      onCloseAutoFocus={(event) => {
        if (navigating.current) event.preventDefault();
      }}
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
              disabled={readsPending || !online || !state.data.unreadCount}
              onClick={() => void mark({ allBefore: state.data!.checkedAt })}
            >
              Marcar todas como leídas
            </button>
          </div>
        )}
        {readsPending && <small role="status">Guardando lecturas…</small>}
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
              <a
                className="notification-link"
                href={notificationHref(item)}
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  navigating.current = true;
                  onOpenNotification(item);
                }}
              >
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>
                  {labels[item.kind]} · {formatDateTime(item.created_at)}
                </small>
              </a>
              {!item.read_at && (
                <button
                  className="text-button"
                  disabled={!online}
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
            disabled={busy || readsPending || !online}
            onClick={() => void next()}
          >
            {busy ? "Cargando…" : "Cargar más"}
          </button>
        )}
      </div>
    </Modal>
  );
}
