import { Check, ShoppingCart, Users, CircleHelp } from "lucide-react";
import { getOwnershipInfo } from "@/lib/journal/ownership";
export { getOwnershipInfo, ownershipOptions } from "@/lib/journal/ownership";

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
