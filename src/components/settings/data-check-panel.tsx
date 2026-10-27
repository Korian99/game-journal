"use client";
import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { useJournalLocation } from "@/hooks/use-journal-location";
import { useDataCheckState } from "@/hooks/use-data-check-state";
import {
  dataChecks,
  findingEnabled,
  findingHidden,
  findingLabels,
  findingKinds,
  categoryLabels,
  preferenceLabels,
  type FindingKind,
  type FindingCategory,
} from "@/lib/journal/data-checks";
export function DataCheckPanel({
  records,
  recordsReady,
  recordsError,
  online,
  blocked,
  dirty,
  location,
  onView,
  onEdit,
  onReload,
}: {
  records: JournalEntry[];
  recordsReady: boolean;
  recordsError: boolean;
  online: boolean;
  blocked: boolean;
  dirty: boolean;
  location: ReturnType<typeof useJournalLocation>;
  onView: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  onReload: () => void;
}) {
  const settings = useDataCheckState(online);
  const findings = useMemo(() => dataChecks(records), [records]);
  const { checkCategory, checkKind, checkHidden } = location;
  const enabled = findings.filter((f) =>
    findingEnabled(f, settings.preferences),
  );
  const hidden = (finding: (typeof findings)[number]) =>
    findingHidden(finding, settings.state.data.dismissals);
  const filtered = enabled.filter(
    (f) =>
      (!checkCategory || f.category === checkCategory) &&
      (!checkKind || f.kind === checkKind) &&
      (checkHidden || !hidden(f)),
  );
  const filterKey = JSON.stringify([checkCategory, checkKind, checkHidden]);
  const [page, setPage] = useState({ key: filterKey, count: 50 });
  const count = page.key === filterKey ? page.count : 50;
  const disabled =
    blocked ||
    !!settings.command ||
    !online ||
    settings.state.checkedAt === null;
  return (
    <article className="panel data-checks">
      <div className="section-title">
        <h2>Revisar datos</h2>
        {settings.command && (
          <span className="inline-save-status" role="status">
            <LoaderCircle size={15} className="save-spinner" />
            Guardando…
          </span>
        )}
      </div>
      <p className="muted">
        Avisos informativos. Los datos solo cambian al editar una partida.
      </p>
      {settings.error && (
        <p className="error" role="alert">
          {settings.error}
        </p>
      )}
      {settings.state.error && (
        <p className="error" role="alert">
          {settings.state.error}{" "}
          {settings.state.checkedAt !== null &&
            "Se conserva la última versión."}{" "}
          <button
            className="text-button"
            disabled={!online || !!settings.command}
            onClick={() => void settings.reload()}
          >
            Reintentar preferencias
          </button>
        </p>
      )}
      {settings.state.checkedAt === null && !settings.state.error && (
        <p className="muted" role="status">
          {online
            ? "Cargando preferencias…"
            : "Las preferencias requieren conexión."}
        </p>
      )}
      {!online && (
        <p className="muted">
          Sin conexión. Puedes consultar los juegos cargados; guardar
          preferencias requiere conexión.
        </p>
      )}
      {dirty && (
        <p className="banner">
          Guarda o cancela la edición actual antes de abrir otra partida.
        </p>
      )}
      <fieldset className="data-check-preferences" disabled={disabled}>
        <legend>Recordatorios opcionales</legend>
        {(
          Object.keys(preferenceLabels) as (keyof typeof preferenceLabels)[]
        ).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              aria-label={preferenceLabels[key]}
              checked={settings.preferences[key]}
              onChange={(event) =>
                void settings.update({
                  action: "preference",
                  key,
                  enabled: event.target.checked,
                })
              }
            />
            {preferenceLabels[key]}
          </label>
        ))}
      </fieldset>
      <div className="data-check-counts">
        {Object.entries(categoryLabels).map(([category, label]) => (
          <span key={category}>
            {label}:{" "}
            <strong>
              {
                enabled.filter((f) => f.category === category && !hidden(f))
                  .length
              }
            </strong>
          </span>
        ))}
        <span>
          Ocultos: <strong>{enabled.filter(hidden).length}</strong>
        </span>
      </div>
      <div className="data-check-controls">
        <label>
          Categoría
          <select
            aria-label="Categoría de aviso"
            value={checkCategory}
            onChange={(e) =>
              location.setCheckCategory(e.target.value as FindingCategory | "")
            }
          >
            <option value="">Todas</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de aviso
          <select
            aria-label="Tipo de aviso"
            value={checkKind}
            onChange={(e) =>
              location.setCheckKind(e.target.value as FindingKind | "")
            }
          >
            <option value="">Todos</option>
            {findingKinds.map((kind) => (
              <option key={kind} value={kind}>
                {findingLabels[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="data-check-hidden">
          <input
            type="checkbox"
            checked={checkHidden}
            onChange={(e) => location.setCheckHidden(e.target.checked)}
          />
          Mostrar ocultos
        </label>
      </div>
      {!recordsReady ? (
        <p role="status">
          {recordsError
            ? "No se pudieron cargar los juegos."
            : "Cargando juegos…"}
          <button className="text-button" disabled={!online} onClick={onReload}>
            Reintentar juegos
          </button>
        </p>
      ) : filtered.length ? (
        <div className="data-check-list">
          {filtered.slice(0, count).map((finding) => {
            const isHidden = hidden(finding);
            return (
              <section
                className={
                  "data-check-finding " + (isHidden ? "is-hidden" : "")
                }
                key={finding.id}
              >
                <div>
                  <span className="eyebrow">
                    {categoryLabels[finding.category]}
                    {isHidden ? " · Oculto" : ""}
                  </span>
                  <h3>{finding.entry.title}</h3>
                  <strong>{findingLabels[finding.kind]}</strong>
                  <p>{finding.message}</p>
                </div>
                <div className="data-check-actions">
                  <button
                    className="secondary"
                    disabled={blocked || !!settings.command}
                    aria-label={"Ver juego " + finding.entry.title}
                    onClick={() => onView(finding.entry)}
                  >
                    Ver juego
                  </button>
                  <button
                    className="secondary"
                    disabled={blocked || !!settings.command}
                    aria-label={"Editar " + finding.entry.title}
                    onClick={() => onEdit(finding.entry)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button"
                    disabled={disabled}
                    aria-label={
                      (isHidden ? "Mostrar aviso de " : "Ocultar aviso de ") +
                      finding.entry.title
                    }
                    onClick={() =>
                      void settings.update({
                        action: isHidden ? "restore" : "dismiss",
                        entryId: finding.entry.id!,
                        kind: finding.kind,
                        values: finding.values,
                      })
                    }
                  >
                    {isHidden ? "Volver a mostrar" : "Ocultar"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="muted">No hay avisos con estos filtros.</p>
      )}
      {filtered.length > count && (
        <button
          className="secondary"
          onClick={() => setPage({ key: filterKey, count: count + 50 })}
        >
          Mostrar más avisos ({filtered.length - count})
        </button>
      )}
    </article>
  );
}
