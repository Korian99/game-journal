/**
 * Canonicalize console labels only; review text and import source snapshots stay intact.
 * A label such as "GBA Emulator" describes emulated play and becomes "Emulador".
 */
export function normalizeConsoleLabels(value: string): string {
  const isEmulation = (name: string) =>
    /(?:^|[^a-z])emula[a-z]*(?:$|[^a-z])/i.test(
      name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
  const labels = value
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!labels.some(isEmulation)) return value;
  const seen = new Set<string>();
  return labels
    .map((name) => (isEmulation(name) ? "Emulador" : name))
    .filter((name) => {
      const key = name.toLocaleLowerCase("es");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("; ");
}
