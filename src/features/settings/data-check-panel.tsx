"use client";
import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { JournalEntry } from "@/lib/journal/journal-types";
import type { useJournalLocation } from "@/features/journal/use-journal-location";
import { DataCheckControls } from "./data-check-controls";
import { DataCheckFindingsList } from "./data-check-findings-list";
import { useDataCheckState } from "./use-data-check-state";
import {
  dataChecks,
  findingEnabled,
  findingHidden,
} from "./data-checks";
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
      <DataCheckControls
        preferences={settings.preferences}
        preferencesDisabled={disabled}
        countCategory={(category) =>
          enabled.filter((finding) => finding.category === category && !hidden(finding)).length
        }
        hiddenCount={enabled.filter(hidden).length}
        category={checkCategory}
        kind={checkKind}
        showHidden={checkHidden}
        onPreferenceChange={(key, enabled) =>
          void settings.update({ action: "preference", key, enabled })
        }
        onCategoryChange={location.setCheckCategory}
        onKindChange={location.setCheckKind}
        onShowHiddenChange={location.setCheckHidden}
      />
      <DataCheckFindingsList
        findings={filtered.slice(0, count)}
        hidden={hidden}
        moreCount={filtered.length - count}
        recordsReady={recordsReady}
        recordsError={recordsError}
        online={online}
        navigationDisabled={blocked || !!settings.command}
        dismissalDisabled={disabled}
        onView={onView}
        onEdit={onEdit}
        onReload={onReload}
        onToggleDismissal={(finding, isHidden) => {
          const { kind } = finding;
          if (kind === "completion") return;
          void settings.update({
            action: isHidden ? "restore" : "dismiss",
            entryId: finding.entry.id!,
            kind,
            values: finding.values,
          });
        }}
        onShowMore={() => setPage({ key: filterKey, count: count + 50 })}
      />
    </article>
  );
}
