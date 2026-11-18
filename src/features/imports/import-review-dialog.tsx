"use client";

import { apiRequest } from "@/lib/api-client";
import type { ImportBatch } from "./contracts";
import { ImportReviewList } from "./import-review-list";
export type { ImportBatch } from "./contracts";
import type { PerformJournalAction } from "@/lib/journal/journal-types";
import { Modal } from "@/components/ui/dialog";

export type ImportResolutions = Record<string, Record<string, string>>;
export function ImportReviewDialog({
  batch,
  resolutions,
  setResolutions,
  busy,
  performAction,
  onClose,
}: {
  batch: ImportBatch;
  resolutions: ImportResolutions;
  setResolutions: (value: ImportResolutions) => void;
  busy: boolean;
  performAction: PerformJournalAction;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Revisar importación">
      <div className="modal-body">
        <p>
          {batch.plan.filter((p) => p.kind === "add").length} nuevas ·{" "}
          {batch.plan.filter((p) => p.kind === "update").length} cambios ·{" "}
          {batch.plan.filter((p) => p.kind === "conflict").length} con
          conflictos
        </p>
        <ImportReviewList
          plan={batch.plan}
          resolutions={resolutions}
          onResolveConflict={(sourceKey, field, value) =>
            setResolutions({
              ...resolutions,
              [sourceKey]: {
                ...resolutions[sourceKey],
                [field]: value,
              },
            })
          }
        />
        <button
          className="primary"
          disabled={
            busy ||
            batch.plan.some((p) =>
              p.conflicts.some((f) => !resolutions[p.incoming.sourceKey]?.[f]),
            )
          }
          onClick={async () => {
            if (
              await performAction(
                () =>
                  apiRequest("/api/import", "POST", {
                    action: "apply",
                    batchId: batch.batchId,
                    resolutions,
                  }),
                "Importación aplicada.",
              )
            )
              onClose();
          }}
        >
          Confirmar importación
        </button>
      </div>
    </Modal>
  );
}
