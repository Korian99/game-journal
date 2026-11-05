"use client";

import { apiRequest } from "@/lib/api-client";
import {
  importConflictLabel,
  importConflictValue,
  type ImportBatch,
} from "./contracts";
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
        {batch.plan
          .filter((p) => p.kind !== "unchanged")
          .map((p, i) => (
            <article className="import-item" key={i}>
              <strong>{p.incoming.title}</strong>
              {p.conflicts.includes("trash") && (
                <p className="error">
                  Esta entrada está en Papelera. Restaurala desde Configuración
                  antes de actualizarla.
                </p>
              )}
              <span className="muted">
                {" "}
                ·{" "}
                {
                  {
                    add: "Nueva",
                    update: "Cambios",
                    conflict: "Requiere revisión",
                    unchanged: "Sin cambios",
                  }[p.kind]
                }
              </span>
              {Object.keys(p.changes).length > 0 && (
                <p className="fine-print">
                  Campos:{" "}
                  {Object.keys(p.changes)
                    .filter((k) => !["raw", "links"].includes(k))
                    .map(importConflictLabel)
                    .join(", ")}
                </p>
              )}
              {p.conflicts.map((field) => (
                <label key={field}>
                  {importConflictLabel(field)}
                  <select
                    value={resolutions[p.incoming.sourceKey]?.[field] ?? ""}
                    onChange={(e) =>
                      setResolutions({
                        ...resolutions,
                        [p.incoming.sourceKey]: {
                          ...resolutions[p.incoming.sourceKey],
                          [field]: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Elegí qué conservar</option>
                    {["duplicate", "trash"].includes(field) ? (
                      <option value="skip">Omitir y revisar en la app</option>
                    ) : (
                      <>
                        <option value="app">
                          Conservar lo editado en la app
                        </option>
                        <option value="sheet">
                          Usar planilla:{" "}
                          {importConflictValue(p.incoming, field)}
                        </option>
                      </>
                    )}
                  </select>
                </label>
              ))}
            </article>
          ))}
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
