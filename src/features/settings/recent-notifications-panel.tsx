import { notificationHref } from "@/features/notifications/navigation";
import type { JournalNotification } from "@/lib/contracts";
import { formatDateTime } from "@/lib/journal/view-config";

export function RecentNotificationsPanel({
  notifications,
  loadError,
  markReadDisabled,
  onMarkRead,
  onOpenNotification,
}: {
  notifications: JournalNotification[];
  loadError: boolean;
  markReadDisabled: boolean;
  onMarkRead: () => void;
  onOpenNotification: (notification: JournalNotification) => void;
}) {
  return (
    <article className="panel">
      <div className="notification-heading">
        <h2>Últimas novedades</h2>
        {notifications.some((n) => !n.read_at) && (
          <button
            className="text-button"
            disabled={markReadDisabled}
            onClick={onMarkRead}
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
                onOpenNotification(n);
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
          {loadError ? "No se pudieron cargar las alertas." : "Sin alertas."}
        </p>
      )}
    </article>
  );
}
