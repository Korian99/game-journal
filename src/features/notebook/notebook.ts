import { z } from "zod";

export const notebookSchema = z.strictObject({
  content: z.string().max(100000),
});

export type NotebookState = z.infer<typeof notebookSchema>;
