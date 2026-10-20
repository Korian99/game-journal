"use client";
import { apiRequest } from "@/lib/api-client";
import { statusAfterDateEdits } from "@/lib/journal/entry-status";
import type {
  JournalEntry,
  PerformJournalAction,
} from "@/lib/journal/journal-types";
import { parseRelease } from "@/lib/releases";
import { statuses, type Offer } from "@/lib/types";
import { pagesSchema, releaseSchema } from "@/lib/validation";
import { formatDate, formatDateTime } from "@/lib/journal/view-config";
import { Check, ExternalLink, Share2, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { EntryActionsMenu } from "./entry-actions-menu";
import { OfferEditor } from "../offers/offer-editor";
import { getOwnershipInfo, ownershipOptions } from "./ownership-badge";
import { PlatformPicker } from "./platform-picker";
import { ReleaseField } from "./release-field";
import { Modal } from "../ui/dialog";

export function EntryEditor({
  entry,
  offers,
  members,
  grants,
  busy,
  onClose,
  onSave,
  onDelete,
  runAction,
}: {
  entry: JournalEntry;
  offers: Offer[];
  members: any[];
  grants: any[];
  busy: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => Promise<void>;
  onDelete: () => Promise<boolean>;
  runAction: PerformJournalAction;
}) {
  const [draft, setDraft] = useState({ ...entry });
  const [pageUrl, setPageUrl] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [priceHistory, setPriceHistory] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState("main");
  const [pageError, setPageError] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const editorId = useId();
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const deleting = useRef(false);
  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
    else if (wasConfirming.current)
      document.getElementById(editorId + "-options")?.focus();
    wasConfirming.current = confirmDelete;
  }, [confirmDelete, editorId]);
  async function deleteEntry() {
    if (busy || deleting.current) return;
    deleting.current = true;
    setDeleteError("");
    try {
      if (!(await onDelete()))
        setDeleteError(
          "No se pudo eliminar la entrada. Podés volver a intentarlo.",
        );
    } catch {
      setDeleteError(
        "No se pudo eliminar la entrada. Podés volver a intentarlo.",
      );
    } finally {
      deleting.current = false;
    }
  }
  const formId = editorId + "-form";
  const tabs = [
    { id: "main", label: "Principal" },
    { id: "playthrough", label: "Partida" },
    { id: "review", label: "Reseña" },
    { id: "more", label: "Más" },
  ];
  const updateDraftField = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const renderField = (
    key: keyof JournalEntry,
    label: string,
    type = "text",
  ) => (
    <label key={key}>
      {label}
      <input
        id={editorId + "-" + key}
        form={formId}
        type={type}
        required={key === "title"}
        value={
          key === "started" || key === "finished"
            ? formatDate(String(draft[key] ?? ""))
            : String(draft[key] ?? "")
        }
        placeholder={
          key === "started" || key === "finished" ? "dd/mm/aaaa" : undefined
        }
        onChange={(e) =>
          updateDraftField(
            key,
            type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
  if (confirmDelete && entry.id)
    return (
      <Modal
        open
        title="Eliminar entrada"
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
      >
        <div className="modal-body delete-entry-confirmation">
          <p>
            ¿Querés eliminar esta entrada de <strong>{entry.title}</strong>?
          </p>
          <p className="muted delete-entry-context">
            {[
              statuses[entry.status],
              entry.device,
              entry.started ? "Empecé: " + formatDate(entry.started) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="fine-print">
            Las demás partidas de este juego se conservan. Esta acción no se
            puede deshacer desde la app.
          </p>
          {deleteError && (
            <p className="delete-entry-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="delete-entry-buttons">
            <button
              ref={cancelDelete}
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger delete-entry-confirm"
              disabled={busy}
              onClick={deleteEntry}
            >
              <Trash2 size={16} />
              {busy ? "Eliminando…" : "Confirmar eliminación"}
            </button>
          </div>
        </div>
      </Modal>
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={entry.id ? "Tu partida" : "Agregar un juego"}
      onEscapeKeyDown={(event) => {
        const trigger = document.getElementById(editorId + "-options");
        const menu = trigger?.closest("details");
        if (menu?.open) {
          event.preventDefault();
          menu.open = false;
          trigger?.focus();
        }
      }}
      headerActions={
        entry.id ? (
          <EntryActionsMenu
            triggerId={editorId + "-options"}
            busy={busy}
            onDeleteRequest={() => {
              setDeleteError("");
              setConfirmDelete(true);
            }}
          />
        ) : undefined
      }
    >
      <div className="modal-body entry-editor">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.title.trim()) {
              setActiveTab("main");
              requestAnimationFrame(() => {
                const name = document.getElementById(
                  editorId + "-title",
                ) as HTMLInputElement | null;
                name?.focus();
                name?.reportValidity();
              });
              return;
            }
            const release = releaseSchema.safeParse(draft.release ?? "");
            if (!release.success) {
              setReleaseError(release.error.issues[0].message);
              setActiveTab("more");
              return;
            }
            setReleaseError("");
            const pages = pagesSchema.safeParse([
              ...(draft.pages ?? []),
              ...(pageUrl.trim() ? [pageUrl] : []),
            ]);
            if (!pages.success) {
              setPageError(
                pages.error.issues[0]?.message ?? "Revisá las páginas.",
              );
              setActiveTab("main");
              return;
            }
            setPageError("");
            onSave({
              ...draft,
              pages: pages.data,
              status: statusAfterDateEdits(draft, entry),
            });
          }}
        />
        <div
          className="editor-tabs"
          role="tablist"
          aria-label="Secciones del juego"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const index = tabs.findIndex((tab) => tab.id === activeTab);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                    tabs.length;
            setActiveTab(tabs[next].id);
            document
              .getElementById(editorId + "-tab-" + tabs[next].id)
              ?.focus();
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={editorId + "-tab-" + tab.id}
              aria-controls={editorId + "-panel-" + tab.id}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-main"}
          aria-labelledby={editorId + "-tab-main"}
          hidden={activeTab !== "main"}
        >
          {activeTab === "main" && (
            <>
              {renderField("title", "Nombre del juego")}
              <PlatformPicker
                label="Plataformas disponibles"
                value={draft.platforms}
                onChange={(value) => updateDraftField("platforms", value)}
                form={formId}
                multiple
              />
              <div className="form-grid">
                <label>
                  Estado
                  <select
                    form={formId}
                    aria-label="Estado"
                    value={draft.status}
                    onChange={(e) => updateDraftField("status", e.target.value)}
                  >
                    {Object.entries(statuses).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Acceso al juego
                  <select
                    form={formId}
                    value={getOwnershipInfo(draft.ownership).value}
                    onChange={(event) =>
                      updateDraftField("ownership", event.target.value)
                    }
                  >
                    <option value="" disabled>
                      Sin definir
                    </option>
                    {draft.ownership &&
                      !ownershipOptions.some(
                        (option) =>
                          option.value ===
                          getOwnershipInfo(draft.ownership).value,
                      ) && (
                        <option value={draft.ownership}>
                          {draft.ownership} (actual)
                        </option>
                      )}
                    {ownershipOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {renderField("priority", "Prioridad")}
                {renderField("estimated", "Horas estimadas")}
              </div>
              <section className="editor-section">
                <h3>
                  Páginas <span className="muted">· opcional</span>
                </h3>
                {offers.map((offer) => (
                  <OfferEditor
                    key={offer.id}
                    offer={offer}
                    runAction={runAction}
                    showHistory={async () =>
                      setPriceHistory(
                        await apiRequest("/api/offers?id=" + offer.id),
                      )
                    }
                  />
                ))}
                {(draft.pages ?? []).length > 0 && (
                  <ul className="draft-pages" aria-label="Páginas del juego">
                    {draft.pages?.map((page) => (
                      <li key={page}>
                        <a
                          href={page}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {page}
                          <ExternalLink size={13} />
                        </a>
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label={"Quitar página " + page}
                          disabled={busy}
                          onClick={() =>
                            updateDraftField(
                              "pages",
                              draft.pages?.filter((value) => value !== page),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const pages = pagesSchema.safeParse([
                      ...(draft.pages ?? []),
                      pageUrl,
                    ]);
                    if (!pages.success) {
                      setPageError(
                        pages.error.issues[0]?.message ?? "Revisá el enlace.",
                      );
                      return;
                    }
                    updateDraftField("pages", pages.data);
                    setPageUrl("");
                    setPageError("");
                  }}
                >
                  <input
                    type="url"
                    aria-label="Enlace de página"
                    placeholder="https://…"
                    value={pageUrl}
                    onChange={(event) => {
                      setPageUrl(event.target.value);
                      setPageError("");
                    }}
                    required
                    disabled={busy}
                  />
                  <button className="secondary" disabled={busy}>
                    Agregar
                  </button>
                </form>
                {pageError && (
                  <p className="error" role="alert">
                    {pageError}
                  </p>
                )}
                <p className="fine-print">
                  Precios: Steam y Nintendo. Otras páginas: referencia.
                </p>
                {priceHistory && (
                  <div className="history">
                    {priceHistory.length ? (
                      priceHistory.map((quote) => (
                        <p key={quote.id}>
                          {formatDateTime(quote.created_at)} · {quote.currency}{" "}
                          {quote.price} · {quote.discount}% OFF
                        </p>
                      ))
                    ) : (
                      <p>Todavía no hay cambios de precio registrados.</p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-playthrough"}
          aria-labelledby={editorId + "-tab-playthrough"}
          hidden={activeTab !== "playthrough"}
        >
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
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-review"}
          aria-labelledby={editorId + "-tab-review"}
          hidden={activeTab !== "review"}
        >
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
        </section>
        <section
          className="editor-panel"
          role="tabpanel"
          id={editorId + "-panel-more"}
          aria-labelledby={editorId + "-tab-more"}
          hidden={activeTab !== "more"}
        >
          <ReleaseField
            record={draft}
            form={formId}
            error={releaseError}
            onChange={(release) => {
              const parsed = parseRelease(release);
              setDraft((current) => ({
                ...current,
                release,
                year: parsed.kind === "unknown" ? null : parsed.year,
              }));
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
                        <option value={draft.hype}>
                          {draft.hype} (actual)
                        </option>
                      )}
                    {["Bajo", "Medio", "Dunno", "Alto", "Hyper"].map(
                      (level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ),
                    )}
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
                        disabled={!recipientId}
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
                        disabled={busy}
                      >
                        Nueva partida
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
        <div className="entry-editor-actions">
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy}
          >
            {busy ? "Guardando…" : "Guardar entrada"}
            <Check size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
