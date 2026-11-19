import { useState, type CSSProperties } from "react";
import { Modal } from "@/components/ui/dialog";
import {
  defaultJournalPalette,
  paletteContrastIssue,
  palettePresets,
  paletteRoles,
  paletteTokens,
  type JournalPalette,
  type PaletteMode,
} from "./journal-palette";

export function JournalPaletteDialog({
  palette,
  onApply,
  onClose,
  onReturnFocus,
}: {
  palette: JournalPalette | null;
  onApply: (palette: JournalPalette | null) => void;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const [draft, setDraft] = useState(palette);
  const [mode, setMode] = useState<PaletteMode>(() =>
    document.documentElement.classList.contains("light") ? "light" : "dark",
  );
  const colors = (draft ?? defaultJournalPalette)[mode];
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
          {palettePresets.map(({ label, palette: preset }) => (
            <button
              key={label}
              type="button"
              aria-pressed={JSON.stringify(draft ?? defaultJournalPalette) === JSON.stringify(preset)}
              onClick={() => setDraft(label === "Cuaderno" ? null : preset)}
            >
              <span className="journal-palette-dots" aria-hidden="true">
                {paletteRoles.map(([role]) => <span key={role} style={{ backgroundColor: preset[mode][role] }} />)}
              </span>
              {label}
            </button>
          ))}
        </fieldset>
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
