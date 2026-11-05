import { z } from "zod";

export const scoringEntrySchema = z.strictObject({
  score_threshold: z.number().int().min(0).max(100),
  meaning: z.string().trim().min(1, "Escribí un significado.").max(2000),
});
export const scoringGuideSchema = z.strictObject({
  entries: z
    .array(scoringEntrySchema)
    .min(1)
    .max(101)
    .refine(
      (entries) =>
        new Set(entries.map((entry) => entry.score_threshold)).size ===
        entries.length,
      "Cada puntaje debe aparecer una sola vez.",
    ),
});
export type ScoringEntry = z.infer<typeof scoringEntrySchema>;
export const defaultScoringGuide: ScoringEntry[] = [
  {
    score_threshold: 100,
    meaning:
      "Un juego perfecto, más allá de su género, atrapante por todos lados, cereza del pastel",
  },
  {
    score_threshold: 90,
    meaning:
      "Tremendo juego, fallas menores pero sus aciertos son mucho más grandes, memorable como top tier de su género",
  },
  {
    score_threshold: 80,
    meaning:
      "La definición de juego sólido (en su género), las fallas están pero no son lo suficientemente grandes como para cagar la experiencia overall",
  },
  {
    score_threshold: 70,
    meaning:
      "Juego divertido, pero sus puntos flojos están claramente ahí y sí empeoran un poco la experiencia",
  },
  {
    score_threshold: 60,
    meaning:
      "Experiencia pasable pero los puntos flojos son considerables durante el total de la experiencia",
  },
  {
    score_threshold: 50,
    meaning:
      "Sus puntos negativos son más que los positivos, pero bueno, es pasable",
  },
  {
    score_threshold: 40,
    meaning:
      "Algo es rescatable, pero no podría ser recomendado porque en general no lo es",
  },
  {
    score_threshold: 30,
    meaning: "Una parte menor fue entretenida, pero en mayor parte malo",
  },
  {
    score_threshold: 20,
    meaning: "Alguna estupidez se rescata, pero no hay con qué darle, es malo",
  },
  { score_threshold: 10, meaning: "No hay que rescatar, malo total" },
  { score_threshold: 0, meaning: "Ofensivamente malo" },
];
