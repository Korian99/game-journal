"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { scoringGuideFormMessages } from "./scoring-guide-form";
import { ScoringGuide } from "./scoring-guide-panel";

export function ScoringGuideButton() {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  function close() {
    if (!dirty || window.confirm(scoringGuideFormMessages.discard)) {
      setOpen(false);
      setDirty(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-button"
        onClick={() => setOpen(true)}
      >
        Guía de reseñas
      </button>
      {open && (
        <Modal open onClose={close} title="Guía de reseñas">
          <ScoringGuide onDirtyChange={setDirty} />
        </Modal>
      )}
    </>
  );
}
