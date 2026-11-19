import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Gamepad2 } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { GameCover } from "@/features/entries/game-cover";
import { effectiveCoverUrl } from "@/lib/covers";
import type { JournalEntry } from "@/lib/journal/journal-types";
import { defaultGameThemeColor, sampleCoverColors } from "./game-theme-colors";

const presetColors = [
  ["Ocre", defaultGameThemeColor],
  ["Azul", "#346ab4"],
  ["Verde", "#387152"],
  ["Ciruela", "#835183"],
] as const;

export function gameThemeStyle(color: string): CSSProperties {
  return { "--journal-game-color": color } as CSSProperties;
}

export function GameThemeArtwork({ entry }: { entry: JournalEntry }) {
  return (
    <span className="game-theme-art">
      <Gamepad2 size={18} aria-hidden="true" />
      <GameCover cover={entry.cover} title={entry.title} />
    </span>
  );
}

export function GameThemeDialog({
  entry,
  appliedColor,
  onApply,
  onRemove,
  onClose,
  onReturnFocus,
  onCustomizePalette,
}: {
  entry: JournalEntry;
  appliedColor?: string;
  onApply: (color: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  onReturnFocus: () => void;
  onCustomizePalette?: () => void;
}) {
  const [color, setColor] = useState(appliedColor ?? defaultGameThemeColor);
  const [suggested, setSuggested] = useState<string[]>([]);
  const touched = useRef(false);
  const coverUrl = effectiveCoverUrl(entry.cover);

  useEffect(() => {
    if (!coverUrl) return;
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort(), 2500);
    void sampleCoverColors(coverUrl, request.signal)
      .then((colors) => {
        if (request.signal.aborted || !colors.length) return;
        setSuggested(colors);
        if (!appliedColor && !touched.current) setColor(colors[0]);
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      request.abort();
    };
  }, [coverUrl, appliedColor]);

  function chooseColor(value: string) {
    touched.current = true;
    setColor(value);
  }

  return (
    <Modal
      open
      title="Personalizar Jugando ahora"
      onClose={onClose}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      <div className="modal-body game-theme-dialog" style={gameThemeStyle(color)}>
        <div className="game-theme-preview" role="group" aria-label="Vista previa del encabezado">
          <div><span>Game Journal</span><GameThemeArtwork entry={entry} /></div>
          <strong>Biblioteca</strong>
        </div>
        <fieldset className="game-theme-swatches">
          <legend>Colores sugeridos</legend>
          {[
            ...suggested.map((value, index) => [`De la portada ${index + 1}`, value] as const),
            ...presetColors.filter(([, value]) => !suggested.includes(value)),
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={color === value}
              style={gameThemeStyle(value)}
              onClick={() => chooseColor(value)}
            />
          ))}
        </fieldset>
        <label className="game-theme-custom">
          <input type="color" value={color} onChange={(event) => chooseColor(event.target.value)} />
          Color personalizado
        </label>
        {onCustomizePalette && (
          <button type="button" className="text-button" aria-haspopup="dialog" onClick={onCustomizePalette}>
            Personalizar colores del diario
          </button>
        )}
        <div className="game-theme-actions">
          {onRemove && <button type="button" className="text-button" onClick={onRemove}>Quitar de Jugando ahora</button>}
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" onClick={() => onApply(color)}>Aplicar</button>
        </div>
      </div>
    </Modal>
  );
}
