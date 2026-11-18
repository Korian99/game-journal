"use client";
import { ScoringGuideButton } from "@/features/settings/scoring-guide-dialog";
import type { EditorContext } from "./editor-context";
export function ReviewTab({
  draft,
  updateDraftField,
  renderField,
  formId,
  activeTab,
  omitSummaryFields = false,
}: Pick<
  EditorContext,
  "draft" | "updateDraftField" | "renderField" | "formId" | "activeTab"
> & { omitSummaryFields?: boolean }) {
  return (
    <>
      {activeTab === "review" && (
        <>
          <ScoringGuideButton />
          <div className="form-grid">
            {!omitSummaryFields && renderField("rating", "Reseña / 100", "number")}
            {!omitSummaryFields && renderField("hours", "Horas jugadas", "number")}
            {!omitSummaryFields && renderField("impression", "Impresiones")}
            {renderField("focus", "Historia, gameplay o ambos")}
          </div>
          {!omitSummaryFields && <label>
            Comentarios adicionales · privados
            <textarea
              form={formId}
              rows={5}
              value={draft.review_details}
              onChange={(e) => updateDraftField("review_details", e.target.value)}
            />
          </label>}
        </>
      )}
    </>
  );
}
