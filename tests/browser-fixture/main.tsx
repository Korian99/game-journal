import { createRoot } from "react-dom/client";
import { JournalApp } from "../../src/features/journal/journal-app";
import "../../src/app/globals.css";
if (!localStorage.getItem("journal-library-layout")) {
  localStorage.setItem("journal-library-layout", "list");
}
createRoot(document.getElementById("root")!).render(<JournalApp />);
