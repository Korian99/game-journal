import { z } from "zod";
import { paletteContrastIssue } from "./journal-palette";

const color = z.string().regex(/^#[a-f0-9]{6}$/i);
const roles = z.strictObject({ bg: color, surface: color, text: color, accent: color });
export const appearancePaletteSchema = z.strictObject({ dark: roles, light: roles })
  .refine(({ dark, light }) => !paletteContrastIssue(dark) && !paletteContrastIssue(light));
export const appearanceGameSchema = z.strictObject({ entryId: z.uuid(), color });
export const appearanceSchema = z.strictObject({
  mode: z.enum(["dark", "light"]),
  palette: appearancePaletteSchema.nullable(),
  game: appearanceGameSchema.nullable(),
});
export const appearancePatchSchema = appearanceSchema.partial().refine((value) => Object.keys(value).length > 0);
export const appearanceResponseSchema = z.strictObject({
  memberId: z.uuid(),
  preferences: appearanceSchema.nullable(),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export type AppearancePatch = z.infer<typeof appearancePatchSchema>;
export type AppearanceGame = z.infer<typeof appearanceGameSchema>;
export const defaultAppearance: Appearance = { mode: "dark", palette: null, game: null };
