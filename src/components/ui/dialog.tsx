"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Modal({
  open,
  onClose,
  title,
  children,
  headerActions,
  onEscapeKeyDown,
  variant = "modal",
}: {
  variant?: "modal" | "drawer";
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={
            "modal-content" + (variant === "drawer" ? " drawer-content" : "")
          }
          aria-describedby={undefined}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <div className="modal-header">
            <Dialog.Title>{title}</Dialog.Title>

            <div className="modal-header-controls">
              {headerActions}
              <Dialog.Close className="icon-button" aria-label="Cerrar">
                <X size={20} />
              </Dialog.Close>
            </div>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
