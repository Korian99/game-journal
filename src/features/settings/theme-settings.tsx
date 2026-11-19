"use client";

type Theme = "light" | "dark";

export function ThemeSettings({ theme, onThemeChange, onCustomizePalette }: {
  theme: Theme;
  onThemeChange?: (theme: Theme) => void;
  onCustomizePalette?: (trigger: HTMLButtonElement) => void;
}) {
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
          disabled={!onThemeChange}
          onClick={() => onThemeChange?.("light")}
        >
          Claro
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={theme === "dark"}
          disabled={!onThemeChange}
          onClick={() => onThemeChange?.("dark")}
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
