import { useEffect } from "react";
import { paletteTokens, type JournalPalette } from "./journal-palette";

const modes = ["dark", "light"] as const;

export function useJournalPalette(palette: JournalPalette | null) {
  useEffect(() => {
    if (!palette) return;
    const style = document.documentElement.style;
    const names = modes.flatMap((mode) =>
      Object.entries(paletteTokens(palette[mode])).map(([role, color]) => {
        const name = `--journal-palette-${mode}-${role}`;
        style.setProperty(name, color);
        return name;
      }),
    );
    return () => names.forEach((name) => style.removeProperty(name));
  }, [palette]);
}
