"use client";
import { useId } from "react";
import { X } from "lucide-react";

const commonPlatforms = [
  "PC",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "Nintendo DS",
  "Nintendo 3DS",
  "Game Boy",
  "Game Boy Color",
  "Game Boy Advance",
  "NES",
  "SNES",
  "Nintendo 64",
  "GameCube",
  "Wii",
  "Wii U",
  "PlayStation",
  "PlayStation 2",
  "PlayStation 3",
  "PlayStation 4",
  "PlayStation 5",
  "PSP",
  "PlayStation Vita",
  "Xbox",
  "Xbox 360",
  "Xbox One",
  "Xbox Series X|S",
  "Android",
  "iOS",
  "Dreamcast",
  "Sega Genesis",
];

export function PlatformPicker({
  label,
  value,
  onChange,
  form,
  multiple = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  form: string;
  multiple?: boolean;
}) {
  const id = useId();
  const selected = multiple
    ? value
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const choices = multiple
    ? commonPlatforms.filter(
        (platform) =>
          !selected.some(
            (part) => part.toLowerCase() === platform.toLowerCase(),
          ),
      )
    : [...new Set([...commonPlatforms, "Emulador", ...(value ? [value] : [])])];
  const inputLabel = multiple
    ? "Editar plataformas"
    : "Editar consola o emulador";
  return (
    <fieldset className="platform-picker">
      <legend>{label}</legend>
      <select
        form={form}
        aria-label={label}
        value={multiple ? "" : value}
        onChange={(event) => {
          const choice = event.target.value;
          if (multiple) {
            if (choice) onChange([...selected, choice].join("; "));
          } else onChange(choice);
        }}
      >
        <option value="">
          {multiple ? "Agregar una plataforma…" : "Elegí una consola…"}
        </option>
        {choices.map((platform) => (
          <option key={platform} value={platform}>
            {platform}
          </option>
        ))}
      </select>
      {multiple && selected.length > 0 && (
        <ul className="platform-tags" aria-label="Plataformas seleccionadas">
          {selected.map((platform, index) => (
            <li key={platform + index}>
              <span>{platform}</span>
              <button
                type="button"
                aria-label={"Quitar plataforma " + platform}
                onClick={() =>
                  onChange(selected.filter((_, i) => i !== index).join("; "))
                }
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="platform-manual" htmlFor={id}>
        {inputLabel}
      </label>
      <input
        id={id}
        form={form}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          multiple
            ? "PC; Nintendo DS; otra plataforma"
            : "Consola, PC o emulador"
        }
      />
    </fieldset>
  );
}
