import { createRoot } from "react-dom/client";
import { JournalApp } from "../../src/features/journal/journal-app";
import "../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(<JournalApp />);
