import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JournalApp } from "../../src/features/journal/journal-app";
import "../../src/app/globals.css";
if (!localStorage.getItem("journal-library-layout")) {
  localStorage.setItem("journal-library-layout", "list");
}
const root = document.getElementById("root")!;
if (new URLSearchParams(location.search).has("ssrHydration")) {
  const savedLayout = localStorage.getItem("journal-library-layout");
  localStorage.removeItem("journal-library-layout");
  root.innerHTML = renderToString(<JournalApp />);
  if (savedLayout !== null)
    localStorage.setItem("journal-library-layout", savedLayout);
  (window as Window & { __journalServerList?: boolean }).__journalServerList =
    !!root.querySelector(".notebook-entry-list");
  (window as Window & { __journalHydrationErrors?: string[] }).__journalHydrationErrors = [];
  hydrateRoot(root, <JournalApp />, {
    onRecoverableError(error) {
      (window as Window & { __journalHydrationErrors?: string[] })
        .__journalHydrationErrors?.push(
          error instanceof Error ? error.message : String(error),
        );
    },
  });
} else {
  createRoot(root).render(<JournalApp />);
}
