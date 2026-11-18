"use client";
import { apiRequest } from "@/lib/api-client";

import { EntrySharingPanel } from "./entry-sharing-panel";

import { ReleaseField } from "../release-field";
import type { EditorContext } from "./editor-context";
export function MoreTab({
  online,
  dirty,
  entry,
  draft,
  updateDraftField,
  renderField,
  formId,
  runAction,
  members,
  grants,
  recipientId,
  setRecipientId,
  busy,
  onSave,
  releaseError,
  setReleaseError,
  activeTab,
  hideMovedFields = false,
}: Pick<
  EditorContext,
  | "online"
  | "dirty"
  | "entry"
  | "draft"
  | "updateDraftField"
  | "renderField"
  | "formId"
  | "runAction"
  | "members"
  | "grants"
  | "recipientId"
  | "setRecipientId"
  | "busy"
  | "onSave"
  | "releaseError"
  | "setReleaseError"
  | "activeTab"
> & { hideMovedFields?: boolean }) {
  return (
    <>
      <ReleaseField
        record={draft}
        form={formId}
        error={releaseError}
        onChange={(release) => {
          updateDraftField("release", release);
          setReleaseError("");
        }}
      />

      {activeTab === "more" && (
        <>
          <div className="form-grid">
            <label>
              Escala de producción
              <select
                form={formId}
                aria-label="Escala de producción"
                value={draft.scale ?? ""}
                onChange={(event) =>
                  updateDraftField("scale", event.target.value || null)
                }
              >
                <option value="">Sin especificar</option>
                <option value="indie">Indie</option>
                <option value="aa">AA</option>
                <option value="aaa">AAA</option>
              </select>
            </label>
            {renderField("period", "Año o período jugado")}
            {renderField("memorability", "Memorabilidad / 10", "number")}
            {!hideMovedFields && renderField("replay", "¿Lo rejugarías?")}
            {!hideMovedFields && <label>
              Hype
              <select
                form={formId}
                value={draft.hype}
                onChange={(event) =>
                  updateDraftField("hype", event.target.value)
                }
              >
                <option value="" disabled>
                  Elegí el hype…
                </option>
                {draft.hype &&
                  !["Bajo", "Medio", "Dunno", "Alto", "Hyper"].includes(
                    draft.hype,
                  ) && (
                    <option value={draft.hype}>{draft.hype} (actual)</option>
                  )}
                {["Bajo", "Medio", "Dunno", "Alto", "Hyper"].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>}
          </div>

          {entry.id && (
            <>
              <EntrySharingPanel
                online={online}
                members={members}
                grants={grants}
                recipientId={recipientId}
                onRecipientChange={setRecipientId}
                onRevoke={(grantId) =>
                  runAction(
                    () => apiRequest("/api/sharing", "DELETE", { id: grantId }),
                    "Acceso revocado.",
                  )
                }
                onShare={() =>
                  runAction(
                    () =>
                      apiRequest("/api/sharing", "POST", {
                        entry_id: entry.id,
                        recipient_id: recipientId,
                      }),
                    "Entrada compartida.",
                  )
                }
              />
              <div className="editor-extra-actions">
                {entry.id && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      onSave({
                        ...draft,
                        id: undefined,
                        updated_at: undefined,
                        sourceKey: "",
                        status: "playing",
                        started: new Date().toISOString().slice(0, 10),
                        finished: "",
                        period: String(new Date().getFullYear()),
                        hours: null,
                        rating: null,
                        memorability: null,
                        impression: "",
                        review_details: "",
                        reason: "",
                      })
                    }
                    disabled={busy || dirty}
                  >
                    Nueva partida
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
