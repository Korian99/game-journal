import type { JournalNotification } from "@/lib/contracts";
import type { JournalLocation } from "@/lib/journal/journal-location";

export const notificationKindLabels: Record<
  JournalNotification["kind"],
  string
> = {
  discount: "Descuentos",
  target: "Debajo del Objetivo",
  release: "Lanzamientos",
  test: "Pruebas",
};

type ReadFilter = JournalLocation["notificationRead"];
type KindFilter = JournalLocation["notificationKind"];

export function NotificationHistoryFilters({
  read,
  kind,
  disabled,
  onReadChange,
  onKindChange,
}: {
  read: ReadFilter;
  kind: KindFilter;
  disabled: boolean;
  onReadChange: (read: ReadFilter) => void;
  onKindChange: (kind: KindFilter) => void;
}) {
  return (
    <div className="notification-controls">
      <label>
        Mostrar
        <select
          value={read}
          disabled={disabled}
          onChange={(event) => onReadChange(event.target.value as ReadFilter)}
        >
          <option value="unread">Sin leer</option>
          <option value="all">Todas</option>
        </select>
      </label>
      <label>
        Tipo
        <select
          value={kind}
          disabled={disabled}
          onChange={(event) => onKindChange(event.target.value as KindFilter)}
        >
          <option value="">Todos</option>
          {Object.entries(notificationKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
