"use client";
import type { EditorContext } from "./editor-context";
export function ReviewTab({
  draft,
  updateDraftField,
  renderField,
  formId,
  activeTab,
}: Pick<
  EditorContext,
  "draft" | "updateDraftField" | "renderField" | "formId" | "activeTab"
>) {
  return (
    <>
      {activeTab === "review" && (
        <>
          <div className="form-grid">
            {renderField("rating", "Reseña / 100", "number")}
            {renderField("hours", "Horas jugadas", "number")}
            {renderField("impression", "Impresiones")}
            {renderField("focus", "Historia, gameplay o ambos")}
          </div>
          <label>
            Comentarios adicionales · privados
            <textarea
              form={formId}
              rows={5}
              value={draft.notes}
              onChange={(e) => updateDraftField("notes", e.target.value)}
            />
          </label>
        </>
      )}
    </>
  );
}
