"use client";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { statuses } from "@/lib/types";
import {
  inlineFields,
  type InlineFieldName,
} from "@/lib/journal/inline-editing";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { JournalView } from "@/lib/journal/journal-location";
import { commonPlatforms } from "../../games/platform-picker";
import { InlineEditContext } from "./inline-context";
import { PlayDateInput } from "../../games/play-date-input";
import { InlineReleaseInput } from "./inline-release-input";
export function InlineField({
  entry,
  field,
  children,
  view,
  slot = "value",
}: {
  entry: JournalEntry;
  field: InlineFieldName;
  children?: ReactNode;
  view: JournalView;
  slot?: string;
}) {
  const edit = useContext(InlineEditContext);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasActive = useRef(false);
  const [customDevice, setCustomDevice] = useState(false);
  const active =
    !!edit?.active &&
    edit.active.entry.id === entry.id &&
    edit.active.field === field &&
    edit.active.slot === slot;
  useEffect(() => {
    if (
      !active &&
      wasActive.current &&
      document.activeElement === document.body
    )
      trigger.current?.focus({ preventScroll: true });
    wasActive.current = active;
    if (active) {
      const input = root.current?.querySelector<HTMLElement>(
        "[data-inline-input]",
      );
      input?.focus();
      if (input instanceof HTMLInputElement && input.type !== "number")
        input.select();
    }
  }, [active, customDevice]);
  if (!edit) return <>{children}</>;
  const spec = inlineFields[field];
  if (!active)
    return (
      <button
        type="button"
        ref={trigger}
        data-inline-slot={slot}
        className={"inline-value inline-" + field}
        aria-label={"Editar " + spec.label + " de " + entry.title}
        title={"Editar " + spec.label}
        disabled={!edit.canEdit}
        onClick={() => {
          setCustomDevice(false);
          edit.begin(entry, field, view, slot);
        }}
      >
        {children ?? "—"}
        <Pencil size={10} className="inline-pencil" aria-hidden="true" />
      </button>
    );
  const value = edit.active!.value;
  const props = {
    "data-inline-input": true,
    "aria-label": spec.label,
    disabled: edit.saving,
    value,
    onChange: (event: { target: { value: string } }) =>
      edit.setValue(event.target.value),
  };
  const choices =
    spec.type === "status"
      ? Object.entries(statuses)
      : spec.type === "ownership"
        ? [
            ["No", "Sin comprar"],
            ["Si", "Comprado"],
            ["En Familia", "Acceso familiar"],
          ]
        : spec.type === "hype"
          ? ["Bajo", "Medio", "Dunno", "Alto", "Hyper"].map((value) => [
              value,
              value,
            ])
          : null;
  return (
    <span
      className={
        "inline-editor " +
        (spec.type === "textarea" ? "inline-editor-long" : "")
      }
      ref={root}
      role="group"
      aria-label={"Editar " + spec.label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          edit.cancel();
        }
        if (
          event.key === "Enter" &&
          !(
            event.target instanceof Element && event.target.closest("button")
          ) &&
          (spec.type !== "textarea" || event.ctrlKey || event.metaKey)
        ) {
          event.preventDefault();
          event.stopPropagation();
          void edit.save();
        }
      }}
    >
      {spec.type === "release" ? (
        <InlineReleaseInput
          value={value}
          onChange={edit.setValue}
          disabled={edit.saving}
        />
      ) : spec.type === "date" ? (
        <PlayDateInput
          data-inline-input
          aria-label={spec.label}
          value={value}
          disabled={edit.saving}
          placeholder="dd/mm/aa o dd/mm/aaaa"
          onChange={edit.setValue}
        />
      ) : spec.type === "textarea" ? (
        <textarea {...props} rows={4} />
      ) : spec.type === "device" && !customDevice ? (
        <select
          {...props}
          onChange={(event) => {
            if (event.target.value === "__custom") setCustomDevice(true);
            else edit.setValue(event.target.value);
          }}
        >
          <option value="">Sin consola</option>
          {[
            ...new Set([
              ...commonPlatforms,
              "Emulador",
              "Celular",
              ...(value ? [value] : []),
            ]),
          ].map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
          <option value="__custom">Otra…</option>
        </select>
      ) : choices ? (
        <select {...props}>
          <option value="">Sin definir</option>
          {value && !choices.some(([key]) => key === value) && (
            <option value={value}>{value}</option>
          )}
          {choices.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...props}
          type={spec.type === "number" ? "number" : "text"}
          step={spec.type === "number" ? "any" : undefined}
        />
      )}
      <span className="inline-cell-actions">
        <button
          type="button"
          className="inline-confirm"
          aria-label="Guardar celda"
          title="Guardar (Enter)"
          disabled={edit.saving}
          onClick={() => void edit.save()}
        >
          {edit.saving ? (
            <LoaderCircle size={13} className="save-spinner" />
          ) : (
            <Check size={13} />
          )}
        </button>
        <button
          type="button"
          aria-label="Cancelar celda"
          title="Cancelar (Escape)"
          disabled={edit.saving}
          onClick={edit.cancel}
        >
          <X size={13} />
        </button>
      </span>
    </span>
  );
}
