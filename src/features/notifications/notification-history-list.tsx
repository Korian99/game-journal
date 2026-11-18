import type { JournalNotification } from "@/lib/contracts";
import { formatDateTime } from "@/lib/journal/view-config";
import { notificationHref } from "./navigation";
import { notificationKindLabels } from "./notification-history-filters";

export function NotificationHistoryList({
  items,
  unreadCount,
  loading,
  hasMore,
  busy,
  online,
  readsPending,
  onOpen,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
}: {
  items: JournalNotification[];
  unreadCount: number | null;
  loading: boolean;
  hasMore: boolean;
  busy: boolean;
  online: boolean;
  readsPending: boolean;
  onOpen: (notification: JournalNotification) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
}) {
  return (
    <>
      {unreadCount !== null && (
        <div className="notification-heading">
          <span>{unreadCount} sin leer en total</span>
          <button
            className="text-button"
            disabled={readsPending || !online || !unreadCount}
            onClick={onMarkAllRead}
          >
            Marcar todas como leídas
          </button>
        </div>
      )}
      {readsPending && <small role="status">Guardando lecturas…</small>}
      {loading ? (
        <p role="status">Cargando…</p>
      ) : unreadCount !== null && !items.length ? (
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
                onOpen(item);
              }}
            >
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>
                {notificationKindLabels[item.kind]} ·{" "}
                {formatDateTime(item.created_at)}
              </small>
            </a>
            {!item.read_at && (
              <button
                className="text-button"
                disabled={!online}
                onClick={() => onMarkRead(item.id)}
              >
                Marcar como leída
              </button>
            )}
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          className="secondary"
          disabled={busy || readsPending || !online}
          onClick={onLoadMore}
        >
          {busy ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </>
  );
}
