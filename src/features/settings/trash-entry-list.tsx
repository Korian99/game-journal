import type { JournalEntry } from "@/lib/journal/journal-types";
import { formatDateTime } from "@/lib/journal/view-config";

type TrashListEntry = Pick<JournalEntry, "title" | "device"> & {
  id: string;
  deleted_at: string;
};

export function TrashEntryList<Entry extends TrashListEntry>({
  items,
  loading,
  hasError,
  busy,
  onRestore,
  onSelectForPurge,
}: {
  items: Entry[];
  loading: boolean;
  hasError: boolean;
  busy: boolean;
  onRestore: (item: Entry) => void;
  onSelectForPurge: (item: Entry) => void;
}) {
  if (loading) return <p>Consultando…</p>;
  if (!items.length)
    return hasError ? null : <p className="muted">La papelera está vacía.</p>;

  return (
    <>
      {items.map((item) => (
        <div className="trash-item" key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <small>
              {item.device || "Sin consola"} · Eliminada:{" "}
              {formatDateTime(item.deleted_at)}
            </small>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onRestore(item)}
            >
              Restaurar
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => onSelectForPurge(item)}
            >
              Eliminar definitivamente
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
