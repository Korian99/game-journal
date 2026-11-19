import { expect, it } from "vitest";
import { appearancePaletteSchema } from "../src/features/settings/appearance-contracts";
import { gamePalettePresets } from "../src/features/settings/journal-palette";

it("generates three distinct usable palettes in both modes from the pinned accent", () => {
  for (const accent of ["#000000", "#ffffff", "#808080", "#ff0000", "#00ff00", "#0000ff"]) {
    const palettes = gamePalettePresets(accent, []).map(({ palette }) => palette);
    expect(palettes).toHaveLength(3);
    for (const mode of ["dark", "light"] as const) {
      expect(new Set(palettes.map((palette) => JSON.stringify(palette[mode]))).size).toBe(3);
    }
    for (const palette of palettes) expect(appearancePaletteSchema.parse(palette)).toEqual(palette);
  }
});

it("uses the sampled cover colors when available, including very pale and dark colors", () => {
  const accent = "#a46b32";
  const fallback = gamePalettePresets(accent, []);
  const sampled = gamePalettePresets(accent, ["#fffaf8", "#0b1822", "#9d20ea"]);
  sampled.forEach(({ palette }, index) => {
    expect(palette).not.toEqual(fallback[index].palette);
    expect(appearancePaletteSchema.parse(palette)).toEqual(palette);
  });
  expect(gamePalettePresets("#123456", ["#fffaf8", "#0b1822", "#9d20ea"])).toEqual(sampled);
});
