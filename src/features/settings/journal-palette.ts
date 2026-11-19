export const paletteRoles = [
  ["bg", "Fondo"],
  ["surface", "Superficies"],
  ["text", "Texto"],
  ["accent", "Acento"],
] as const;

type Role = (typeof paletteRoles)[number][0];
export type PaletteMode = "dark" | "light";
type RoleColors = Record<Role, string>;
export type JournalPalette = Record<PaletteMode, RoleColors>;

export const palettePresets = [
  {
    label: "Cuaderno",
    palette: {
      dark: { bg: "#222326", surface: "#2b2c30", text: "#eeeae0", accent: "#c4a25a" },
      light: { bg: "#ede5d8", surface: "#f5eee3", text: "#332a21", accent: "#a46b32" },
    },
  },
  {
    label: "Bosque",
    palette: {
      dark: { bg: "#19221d", surface: "#27352c", text: "#eff7eb", accent: "#9bd5a8" },
      light: { bg: "#edf3e9", surface: "#f7faf3", text: "#233a2a", accent: "#367449" },
    },
  },
  {
    label: "Océano",
    palette: {
      dark: { bg: "#161f2c", surface: "#253449", text: "#f0f6ff", accent: "#85c8e8" },
      light: { bg: "#e8f2f6", surface: "#f6fbfd", text: "#24394c", accent: "#25617c" },
    },
  },
  {
    label: "Ciruela",
    palette: {
      dark: { bg: "#231a29", surface: "#37283f", text: "#fff0fc", accent: "#dfa5cb" },
      light: { bg: "#f5eaf2", surface: "#fff6fb", text: "#412d44", accent: "#82466f" },
    },
  },
] satisfies { label: string; palette: JournalPalette }[];

export const defaultJournalPalette = palettePresets[0].palette;

function channels(color: string) {
  return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(color: string) {
  const [red, green, blue] = channels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first) + 0.05;
  const b = luminance(second) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

function mix(first: string, second: string, amount: number) {
  const target = channels(second);
  return "#" + channels(first).map((channel, index) =>
    Math.round(channel + (target[index] - channel) * amount).toString(16).padStart(2, "0"),
  ).join("");
}

export function paletteTokens(colors: RoleColors) {
  return {
    ...colors,
    raised: mix(colors.surface, colors.text, 0.08),
    muted: mix(colors.text, colors.surface, 0.12),
    line: mix(colors.surface, colors.text, 0.26),
    ink: luminance(colors.accent) > 0.179 ? "#000000" : "#ffffff",
  };
}

export function paletteContrastIssue(colors: RoleColors) {
  const { bg, surface, raised, text, muted, accent } = paletteTokens(colors);
  if ([bg, surface, raised].some((base) => contrast(base, text) < 4.5 || contrast(base, muted) < 4.5)) {
    return "Elegí un color de texto que contraste más con el fondo y las superficies.";
  }
  if ([bg, surface, raised].some((base) => contrast(base, accent) < 3)) {
    return "Elegí un acento que se distinga mejor del fondo y las superficies.";
  }
  return null;
}

function withReadableAccent(colors: RoleColors, edge: string): RoleColors {
  for (const strength of [0, 0.25, 0.5, 0.75]) {
    const choice = { ...colors, accent: mix(colors.accent, edge, strength) };
    if (!paletteContrastIssue(choice)) return choice;
  }
  return { ...colors, accent: edge };
}

function tintedPalette(base: string, accent: string, tint: number): JournalPalette {
  return {
    dark: withReadableAccent({
      bg: mix("#14161c", base, tint),
      surface: mix("#272930", base, tint * 0.7),
      text: mix("#fbf8f4", base, 0.07),
      accent,
    }, "#ffffff"),
    light: withReadableAccent({
      bg: mix("#f2efea", base, tint * 0.68),
      surface: mix("#ffffff", base, tint * 0.44),
      text: mix("#231f27", base, 0.11),
      accent,
    }, "#000000"),
  };
}

export function gamePalettePresets(accent: string, coverColors: readonly string[]) {
  const [
    primary = accent,
    secondary = mix(primary, "#75509d", 0.45),
    highlight = mix(primary, "#a56b2f", 0.54),
  ] = coverColors;
  return [
    { label: "Portada", palette: tintedPalette(primary, primary, 0.16) },
    { label: "Ambiental", palette: tintedPalette(secondary, secondary, 0.22) },
    { label: "Contraste", palette: tintedPalette(primary, highlight, 0.07) },
  ];
}
