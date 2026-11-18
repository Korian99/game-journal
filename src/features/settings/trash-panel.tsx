"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { journalEntrySchema } from "@/lib/contracts";
import { TrashEntryList } from "./trash-entry-list";
import { TrashPurgeDialog } from "./trash-purge-dialog";
const trashSchema = z.array(
  journalEntrySchema.and(
    z.object({
      id: z.string(),
      deleted_at: z.string(),
      updated_at: z.string(),
    }),
  ),
);
type Trashed = z.infer<typeof trashSchema>[number];
export function TrashPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<Trashed[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Trashed[] | null>(null);
  async function reload() {
    try {
      setItems(await apiRequest("/api/trash", "GET", undefined, trashSchema));
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  async function restore(item: Trashed) {
    setBusy(true);
    try {
      await apiRequest("/api/trash", "PATCH", {
        id: item.id,
        expected: item.updated_at,
      });
      await reload();
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function purge() {
    if (!selected) return;
    setBusy(true);
    try {
      await apiRequest("/api/trash", "DELETE", {
        items: selected.map((item) => ({
          id: item.id,
          expected: item.updated_at,
        })),
        confirmed: true,
      });
      setSelected(null);
      await reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel">
      <div className="notification-heading">
        <h2>Papelera</h2>
        {items.length > 0 && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => setSelected(items)}
          >
            Vaciar papelera
          </button>
        )}
      </div>
      <p className="fine-print">
        Podés restaurar las entradas durante 30 días. Los permisos de compartir
        no se restauran.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
          <button className="text-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </p>
      )}
      <TrashEntryList
        items={items}
        loading={loading}
        hasError={!!error}
        busy={busy}
        onRestore={(item) => void restore(item)}
        onSelectForPurge={(item) => setSelected([item])}
      />
      {selected && (
        <TrashPurgeDialog
          count={selected.length}
          busy={busy}
          onCancel={() => setSelected(null)}
          onConfirm={() => void purge()}
        />
      )}
    </article>
  );
}
