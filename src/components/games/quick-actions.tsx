"use client";
import { useState } from "react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { statuses } from "@/lib/types";
import { ownershipOptions, getOwnershipInfo } from "./ownership-badge";
export function QuickActions({
  entry,
  disabled,
  onSave,
}: {
  entry: JournalEntry;
  disabled: boolean;
  onSave: (value: JournalEntry) => Promise<boolean>;
}) {
  const [base, setBase] = useState(entry);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(entry.status),
    [priority, setPriority] = useState(String(entry.priority ?? "")),
    [ownership, setOwnership] = useState(entry.ownership),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  return (
    <details className="quick-actions" open={open}>
      <summary
        aria-label={"Acciones rápidas de " + entry.title}
        onClick={(event) => {
          event.preventDefault();
          if (saving) return;
          if (!open) {
            setBase(entry);
            setStatus(entry.status);
            setPriority(String(entry.priority ?? ""));
            setOwnership(entry.ownership);
            setError("");
          }
          setOpen(!open);
        }}
      >
        Cambiar…
      </summary>
      <div className="quick-actions-fields">
        <label>
          Estado
          <select
            aria-label="Estado"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            disabled={disabled || saving}
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <input
            aria-label="Prioridad"
            value={priority}
            maxLength={100}
            onChange={(event) => setPriority(event.target.value)}
            disabled={disabled || saving}
          />
        </label>
        <label>
          Acceso
          <select
            aria-label="Acceso"
            value={getOwnershipInfo(ownership).value}
            onChange={(event) => setOwnership(event.target.value)}
            disabled={disabled || saving}
          >
            {!ownershipOptions.some(
              (option) => option.value === getOwnershipInfo(ownership).value,
            ) && (
              <option value={ownership}>{ownership || "Sin definir"}</option>
            )}
            {ownershipOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="secondary"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              if (await onSave({ ...base, status, priority, ownership })) {
                setOpen(false);
              } else
                setError(
                  "No se guardó el cambio. Abrí la entrada para revisar su versión actual.",
                );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </details>
  );
}
