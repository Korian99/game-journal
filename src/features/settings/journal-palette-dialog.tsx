import { useEffect, useState, type CSSProperties } from "react";
import { Modal } from "@/components/ui/dialog";
import { sampleCoverColors } from "@/features/library/game-theme-colors";
import { effectiveCoverUrl } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import {
  defaultJournalPalette,
  gamePalettePresets,
  paletteContrastIssue,
  palettePresets,
  paletteRoles,
  paletteTokens,
  type JournalPalette,
  type PaletteMode,
} from "./journal-palette";

function PalettePresetButtons({
  presets,
  current,
  mode,
  onSelect,
}: {
  presets: readonly { label: string; palette: JournalPalette }[];
  current: JournalPalette;
  mode: PaletteMode;
  onSelect: (preset: JournalPalette) => void;
}) {
  const currentColors = JSON.stringify(current);
  return presets.map(({ label, palette }) => (
    <button
      key={label}
      type="button"
      aria-pressed={currentColors === JSON.stringify(palette)}
      onClick={() => onSelect(palette)}
    >
      <span className="journal-palette-dots" aria-hidden="true">
        {paletteRoles.map(([role]) => <span key={role} style={{ backgroundColor: palette[mode][role] }} />)}
      </span>
      {label}
    </button>
  ));
}

export function JournalPaletteDialog({
  palette,
  nowPlaying,
  onApply,
  onClose,
  onReturnFocus,
}: {
  palette: JournalPalette | null;
  nowPlaying: { entry: Pick<JournalEntry, "id" | "title" | "cover">; color: string } | null;
  onApply: (palette: JournalPalette | null) => void;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const [draft, setDraft] = useState(palette);
  const [mode, setMode] = useState<PaletteMode>(() =>
    document.documentElement.classList.contains("light") ? "light" : "dark",
  );
  const gameId = nowPlaying?.entry.id;
  const coverUrl = effectiveCoverUrl(nowPlaying?.entry.cover);
  const [sample, setSample] = useState<{ gameId: string; coverUrl: string; colors: string[] } | null>(null);
  useEffect(() => {
    if (!gameId || !coverUrl) return;
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort(), 2500);
    void sampleCoverColors(coverUrl, request.signal)
      .then((colors) => {
        if (!request.signal.aborted) setSample({ gameId, coverUrl, colors });
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timeout));
    return () => {
      request.abort();
      window.clearTimeout(timeout);
    };
  }, [gameId, coverUrl]);

  const coverColors = sample && sample.gameId === gameId && sample.coverUrl === coverUrl ? sample.colors : [];
  const selected = draft ?? defaultJournalPalette;
  const colors = selected[mode];
  const issue = draft && (
    paletteContrastIssue(draft[mode]) ??
    (paletteContrastIssue(draft[mode === "dark" ? "light" : "dark"])
      ? "Revisá el contraste en la vista del otro modo."
      : null)
  );
  const preview = Object.fromEntries(
    Object.entries(paletteTokens(colors)).map(([role, color]) => [`--preview-${role}`, color]),
  ) as CSSProperties;

  return (
    <Modal open title="Colores del diario" onClose={onClose} onCloseAutoFocus={(event) => {
      event.preventDefault();
      onReturnFocus();
    }}>
      <div className="modal-body journal-palette-dialog">
        <div className="journal-palette-mode" role="group" aria-label="Modo de vista previa">
          <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")}>Vista clara</button>
          <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>Vista oscura</button>
        </div>
        <div className="journal-palette-preview" role="group" aria-label="Vista previa del diario" style={preview}>
          <header>Game Journal</header>
          <div>
            <strong>Biblioteca</strong>
            <span>Mi próxima partida</span>
            <span className="journal-palette-preview-add">Agregar juego</span>
          </div>
        </div>
        <fieldset className="journal-palette-presets">
          <legend>Paletas</legend>
          <PalettePresetButtons
            presets={palettePresets}
            current={selected}
            mode={mode}
            onSelect={(preset) => setDraft(preset === defaultJournalPalette ? null : preset)}
          />
        </fieldset>
        {nowPlaying && (
          <fieldset className="journal-palette-presets journal-palette-game-presets">
            <legend>Jugando ahora · {nowPlaying.entry.title}</legend>
            <PalettePresetButtons
              presets={gamePalettePresets(nowPlaying.color, coverColors)}
              current={selected}
              mode={mode}
              onSelect={setDraft}
            />
          </fieldset>
        )}
        <fieldset className="journal-palette-colors">
          <legend>Colores de la vista {mode === "light" ? "clara" : "oscura"}</legend>
          {paletteRoles.map(([role, label]) => (
            <label key={role}>
              <input type="color" value={colors[role]} onChange={(event) => {
                const color = event.currentTarget.value;
                setDraft((previous) => {
                  const selection = previous ?? defaultJournalPalette;
                  return { ...selection, [mode]: { ...selection[mode], [role]: color } };
                });
              }} />
              {label}
            </label>
          ))}
        </fieldset>
        {issue && <p role="alert" className="journal-palette-error">{issue}</p>}
        <div className="game-theme-actions">
          <button type="button" className="text-button" onClick={() => setDraft(null)}>Restaurar colores originales</button>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" disabled={!!issue} onClick={() => onApply(draft)}>Aplicar</button>
        </div>
      </div>
    </Modal>
  );
}
