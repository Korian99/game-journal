import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";

type SortField = readonly [id: string, label: string, initialDirection: "asc" | "desc"];

export function CollectionSortControl({
  className,
  label,
  fields,
  sort,
  setSort,
}: {
  className: string;
  label: string;
  fields: readonly SortField[];
  sort: SortingState;
  setSort: OnChangeFn<SortingState>;
}) {
  const [primary, secondary] = sort;
  const field = fields.find(([id]) => id === primary?.id);
  const combined = primary && (
    !field || (primary.id === "title"
      ? sort.length !== 1
      : sort.length !== 2 || secondary?.id !== "title" || secondary.desc)
  );
  const DirectionIcon = !primary ? ArrowDownUp : primary.desc ? ArrowDown : ArrowUp;
  const directionLabel = !primary
    ? "Cambiar dirección del orden"
    : primary.desc
      ? "Cambiar a orden ascendente"
      : "Cambiar a orden descendente";

  return (
    <div className={`collection-sort ${className}`}>
      <span aria-hidden="true">Ordenar</span>
      <select
        aria-label={label}
        value={combined ? "custom" : (field?.[0] ?? "")}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "custom") return;
          const selected = fields.find(([id]) => id === value);
          if (!selected) {
            setSort([]);
            return;
          }
          const [id, , direction] = selected;
          setSort([
            { id, desc: direction === "desc" },
            ...(id === "title" ? [] : [{ id: "title", desc: false }]),
          ]);
        }}
      >
        <option value="">Sin ordenar</option>
        {combined && (
          <option value="custom">
            {field ? `${field[1]} · combinado` : "Orden combinado"}
          </option>
        )}
        {fields.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={directionLabel}
        title={directionLabel}
        disabled={!primary}
        onClick={() => setSort(([first, ...rest]) => (
          first ? [{ ...first, desc: !first.desc }, ...rest] : []
        ))}
      >
        <DirectionIcon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
