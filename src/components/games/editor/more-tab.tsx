"use client";
import { apiRequest } from "@/lib/api-client";

import { Share2 } from "lucide-react";

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
>) {
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
            {renderField("period", "Año o período jugado")}
            {renderField("memorability", "Memorabilidad / 10", "number")}
            {renderField("replay", "¿Lo rejugarías?")}
            <label>
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
            </label>
          </div>

          {entry.id && (
            <>
              <section className="editor-section">
                <h3>
                  <Share2 size={16} />
                  Compartir esta entrada
                </h3>
                <p className="muted">
                  Se comparten la partida, las horas, las puntuaciones y las
                  impresiones. Motivos y comentarios: privados.
                </p>
                {grants.map((g) => (
                  <div className="button-row" key={g.id}>
                    <span>
                      {members.find((m) => m.id === g.recipient_id)
                        ?.display_name ?? "Persona invitada"}
                    </span>
                    <button
                      className="text-button"
                      disabled={!online}
                      onClick={() =>
                        runAction(
                          () =>
                            apiRequest("/api/sharing", "DELETE", {
                              id: g.id,
                            }),
                          "Acceso revocado.",
                        )
                      }
                    >
                      Revocar acceso
                    </button>
                  </div>
                ))}
                <div className="inline-form">
                  <select
                    disabled={!online}
                    aria-label="Compartir con"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                  >
                    <option value="">Elegí una persona</option>
                    {members
                      .filter(
                        (m) => !grants.some((g) => g.recipient_id === m.id),
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="secondary"
                    disabled={!recipientId || !online}
                    onClick={() =>
                      runAction(
                        () =>
                          apiRequest("/api/sharing", "POST", {
                            entry_id: entry.id,
                            recipient_id: recipientId,
                          }),
                        "Entrada compartida.",
                      )
                    }
                  >
                    Compartir
                  </button>
                </div>
              </section>
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
                        notes: "",
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
