"use client";
import type { ComponentProps } from "react";
import type { StorePreview } from "@/features/stores/store-preview-contract";
import { CoverEditor } from "./cover-editor";
import { MainTab } from "./main-tab";
import { StorePreviewCard } from "./store-preview-card";

type Props = {
  main: ComponentProps<typeof MainTab>;
  cover: ComponentProps<typeof CoverEditor>;
  storePreview: StorePreview | null;
  releaseSaveError: string;
  onLookupPage: () => void;
  onLookupSearch: () => void;
};

export function PrincipalPage({ main, cover, storePreview, releaseSaveError, onLookupPage, onLookupSearch }: Props) {
  const active = main.activeTab === "main";
  return <>
    <div hidden={!active}><CoverEditor {...cover} /></div>
    {active && <>
      <button type="button" className="text-button editor-store-lookup" disabled={main.busy || !main.online} onClick={onLookupPage}>Completar desde una página</button>
      <button type="button" className="text-button editor-store-lookup" disabled={main.busy || !main.online} onClick={onLookupSearch}>Completar desde el buscador</button>
      {storePreview && main.draft.pages?.includes(storePreview.url) && <StorePreviewCard preview={storePreview} />}
      {releaseSaveError && <p className="error" role="alert">{releaseSaveError}</p>}
    </>}
    <MainTab {...main} />
  </>;
}
