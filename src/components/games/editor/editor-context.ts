import type { OfferTargetUpdate } from "@/lib/offers/target-draft";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type {
  JournalEntry,
  PerformJournalAction,
} from "@/lib/journal/journal-types";
import type { Offer } from "@/lib/types";
import type { PriceHistory, SharingMember, ShareGrant } from "@/lib/contracts";
export type EditorContext = {
  entry: JournalEntry;
  online: boolean;
  dirty: boolean;
  draft: JournalEntry;
  setDraft: Dispatch<SetStateAction<JournalEntry>>;
  updateDraftField: (key: keyof JournalEntry, value: unknown) => void;
  renderField: (
    key: keyof JournalEntry,
    label: string,
    type?: string,
  ) => ReactNode;
  formId: string;
  offers: Offer[];
  targetDrafts: Record<string, string>;
  setTargetDraft: (id: string, value: string) => void;
  runAction: PerformJournalAction;
  priceHistory: PriceHistory | null;
  setPriceHistory: Dispatch<SetStateAction<PriceHistory | null>>;
  pageUrl: string;
  setPageUrl: Dispatch<SetStateAction<string>>;
  pageError: string;
  setPageError: Dispatch<SetStateAction<string>>;
  members: SharingMember[];
  grants: ShareGrant[];
  recipientId: string;
  setRecipientId: Dispatch<SetStateAction<string>>;
  busy: boolean;
  onSave: (entry: JournalEntry, targets?: OfferTargetUpdate[]) => Promise<void>;
  releaseError: string;
  setReleaseError: Dispatch<SetStateAction<string>>;
  activeTab: string;
};
