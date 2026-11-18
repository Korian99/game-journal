import {
  importConflictLabel,
  importConflictValue,
  type ImportBatch,
} from "./contracts";
import type { ImportResolutions } from "./import-review-dialog";

export function ImportReviewList({
  plan,
  resolutions,
  onResolveConflict,
}: {
  plan: ImportBatch["plan"];
  resolutions: ImportResolutions;
  onResolveConflict: (sourceKey: string, field: string, value: string) => void;
}) {
  return (
    <>
      {plan
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
                    onResolveConflict(
                      p.incoming.sourceKey,
                      field,
                      e.target.value,
                    )
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
                        Usar planilla: {importConflictValue(p.incoming, field)}
                      </option>
                    </>
                  )}
                </select>
              </label>
            ))}
          </article>
        ))}
    </>
  );
}
