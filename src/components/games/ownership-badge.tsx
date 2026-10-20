import { Check, ShoppingCart, Users, CircleHelp } from "lucide-react";
export const ownershipOptions = [
  { value: "Si", label: "Comprado", className: "owned" },
  { value: "No", label: "Sin comprar", className: "not-owned" },
  { value: "En familia", label: "Acceso familiar", className: "family" },
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
    ownershipOptions.find(
      (option) =>
        normalize(option.value) === key || normalize(option.label) === key,
    ) ?? {
      value,
      label: value.trim() || "Sin definir",
      className: "",
    }
  );
}

export function OwnershipBadge({ value }: { value: string }) {
  const ownership = getOwnershipInfo(value);
  const Icon =
    ownership.className === "owned"
      ? Check
      : ownership.className === "family"
        ? Users
        : ownership.className === "not-owned"
          ? ShoppingCart
          : CircleHelp;
  return (
    <span className={"ownership " + ownership.className}>
      <Icon size={13} aria-hidden="true" />
      {ownership.label}
    </span>
  );
}
