"use client";
import { useState } from "react";
import { parseRelease, releaseSeasons } from "@/lib/releases";
import { currentYear } from "@/lib/journal/view-config";
export function InlineReleaseInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const release = parseRelease(value);
  const [kind, setKind] = useState(release.kind);
  const [year, setYear] = useState(
    release.kind === "unknown" ? currentYear() : String(release.year),
  );
  const [season, setSeason] = useState(
    release.kind === "season" ? release.season : "spring",
  );
  return (
    <span className="inline-release-input">
      <select
        data-inline-input
        aria-label="Tipo de lanzamiento"
        disabled={disabled}
        value={kind}
        onChange={(event) => {
          const mode = event.target.value as typeof kind;
          setKind(mode);
          onChange(
            mode === "unknown" || mode === "date"
              ? ""
              : year + (mode === "season" ? "-" + season : ""),
          );
        }}
      >
        <option value="unknown">Sin fecha</option>
        <option value="date">Fecha exacta</option>
        <option value="season">Temporada</option>
        <option value="year">Año</option>
      </select>
      {kind === "date" && (
        <input
          type="date"
          aria-label="Fecha de lanzamiento"
          disabled={disabled}
          value={release.kind === "date" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {(kind === "season" || kind === "year") && (
        <input
          aria-label="Año de lanzamiento"
          inputMode="numeric"
          disabled={disabled}
          value={year}
          maxLength={4}
          onChange={(event) => {
            setYear(event.target.value);
            onChange(
              event.target.value + (kind === "season" ? "-" + season : ""),
            );
          }}
        />
      )}
      {kind === "season" && (
        <select
          aria-label="Temporada de lanzamiento"
          disabled={disabled}
          value={season}
          onChange={(event) => {
            setSeason(event.target.value);
            onChange(year + "-" + event.target.value);
          }}
        >
          {releaseSeasons.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
