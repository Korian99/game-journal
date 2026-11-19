"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeSettings({ onCustomizePalette }: {
  onCustomizePalette?: (trigger: HTMLButtonElement) => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("journal-theme");
    const initial: Theme = saved === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("light", initial === "light");
    setTheme(initial);
  }, []);

  function selectTheme(next: Theme) {
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("journal-theme", next);
    setTheme(next);
  }

  return (
    <article className="panel settings-appearance">
      <div>
        <p className="eyebrow">
          TEMA ACTUAL: {theme === "light" ? "CLARO" : "OSCURO"}
        </p>
        <h2>Apariencia</h2>
        <p className="muted">Elegí cómo querés leer tu diario.</p>
      </div>
      <div className="theme-choice" role="group" aria-label="Tema de color">
        <button
          className="secondary"
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => selectTheme("light")}
        >
          Claro
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={theme === "dark"}
          onClick={() => selectTheme("dark")}
        >
          Oscuro
        </button>
      </div>
      {onCustomizePalette && (
        <button type="button" aria-haspopup="dialog" onClick={(event) => onCustomizePalette(event.currentTarget)}>
          Personalizar colores
        </button>
      )}
    </article>
  );
}
