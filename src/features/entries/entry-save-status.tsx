import { LoaderCircle } from "lucide-react";
export function EntrySaveStatus() {
  return (
    <span className="entry-save-status" role="status">
      <LoaderCircle size={14} className="save-spinner" aria-hidden="true" />
      Guardando entrada…
    </span>
  );
}
