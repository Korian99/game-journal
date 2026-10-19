export const ownershipOptions = [
  { value: "Si", label: "Sí", className: "owned" },
  { value: "No", label: "No", className: "not-owned" },
  { value: "En familia", label: "En familia", className: "family" },
];

export function getOwnershipInfo(value: string) {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const key = normalize(value);
  if (["en familia", "familia", "acceso familiar"].includes(key))
    return ownershipOptions[2];
  return (
    ownershipOptions.find((option) => normalize(option.value) === key) ?? {
      value,
      label: value || "—",
      className: "",
    }
  );
}

export function OwnershipBadge({ value }: { value: string }) {
  const ownership = getOwnershipInfo(value);
  return (
    <span className={"ownership " + ownership.className}>
      {ownership.label}
    </span>
  );
}
