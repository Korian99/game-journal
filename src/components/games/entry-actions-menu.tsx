"use client";
import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, Trash2 } from "lucide-react";
export function EntryActionsMenu({
  triggerId,
  busy,
  onDeleteRequest,
}: {
  triggerId: string;
  busy: boolean;
  onDeleteRequest: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details
      className="entry-actions-menu"
      ref={menu}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        role="button"
        id={triggerId}
        className="icon-button"
        aria-label="Opciones del juego"
        aria-expanded={open}
        aria-controls={triggerId + "-menu"}
        aria-disabled={busy}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <EllipsisVertical size={20} />
      </summary>
      <div id={triggerId + "-menu"} className="entry-menu-popover">
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => {
            if (menu.current) menu.current.open = false;
            onDeleteRequest();
          }}
        >
          <Trash2 size={16} />
          Eliminar entrada
        </button>
      </div>
    </details>
  );
}
