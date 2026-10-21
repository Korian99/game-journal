"use client";
import { PlatformPicker } from "../platform-picker";

import type { EditorContext } from "./editor-context";
export function PlaythroughTab({
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
      {activeTab === "playthrough" && (
        <>
          <div className="form-grid">
            {renderField("started", "Empecé")}
            {renderField("finished", "Terminé")}
          </div>
          <PlatformPicker
            label="Consola donde jugué"
            value={draft.device}
            onChange={(value) => updateDraftField("device", value)}
            form={formId}
          />
          <label>
            ¿Por qué? · privado
            <textarea
              form={formId}
              rows={3}
              value={draft.reason}
              onChange={(e) => updateDraftField("reason", e.target.value)}
            />
          </label>
        </>
      )}
    </>
  );
}
