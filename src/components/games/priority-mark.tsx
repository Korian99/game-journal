import type { JournalRecord } from "@/lib/types";

export function PriorityMark({ value }: { value: JournalRecord["priority"] }) {
  const priority = typeof value === "string" ? value.trim() : value;
  const label = priority == null || priority === "" ? "—" : String(priority);
  const named = label !== "—" && !Number.isFinite(Number(label));
  return (
    <span
      className={"priority-mark" + (named ? " priority-mark-named" : "")}
      aria-label={label === "—" ? "Sin prioridad" : "Prioridad: " + label}
      title={label === "—" ? "Sin prioridad" : "Prioridad: " + label}
    >
      {label}
    </span>
  );
}
