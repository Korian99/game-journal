export function HypeBadge({ value }: { value: string }) {
  const label = value.trim();
  return label ? (
    <span className="hype-badge" data-level={label.toLowerCase()}>
      {label}
    </span>
  ) : (
    <span className="muted">Sin definir</span>
  );
}
