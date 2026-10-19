"use client";
import { useState } from "react";
import { recordRelease, releaseSeasons } from "@/lib/releases";
import type { JournalRecord } from "@/lib/types";

type Kind = "date" | "season" | "year" | "unknown";
export function ReleaseField({
  record,
  onChange,
  form,
  error,
}: {
  record: Pick<JournalRecord, "release" | "year">;
  onChange: (release: string) => void;
  form: string;
  error: string;
}) {
  const initial = recordRelease(record);
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [year, setYear] = useState(
    initial.kind === "unknown" ? "" : String(initial.year),
  );
  const [date, setDate] = useState(
    initial.kind === "date" ? initial.value : "",
  );
  const [season, setSeason] = useState(
    initial.kind === "season" ? initial.season : "spring",
  );
  function update(mode: Kind, y = year, d = date, s = season) {
    onChange(
      mode === "unknown"
        ? ""
        : mode === "date"
          ? d || "date"
          : mode === "season"
            ? y + "-" + s
            : y || "year",
    );
  }
  return (
    <fieldset className="release-field">
      <legend>Lanzamiento</legend>
      <div className="form-grid">
        <label>
          Precisión del lanzamiento
          <select
            form={form}
            value={kind}
            onChange={(e) => {
              const mode = e.target.value as Kind;
              setKind(mode);
              update(mode);
            }}
          >
            <option value="unknown">Sin fecha</option>
            <option value="date">Fecha exacta</option>
            <option value="season">Temporada</option>
            <option value="year">Año</option>
          </select>
        </label>
        {kind === "date" && (
          <label>
            Fecha de lanzamiento
            <input
              form={form}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                update(kind, year, e.target.value);
              }}
            />
          </label>
        )}
        {kind === "season" && (
          <label>
            Temporada de lanzamiento
            <select
              form={form}
              value={season}
              onChange={(e) => {
                setSeason(e.target.value);
                update(kind, year, date, e.target.value);
              }}
            >
              {releaseSeasons.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {(kind === "season" || kind === "year") && (
          <label>
            Año de lanzamiento
            <input
              form={form}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                update(kind, e.target.value);
              }}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
