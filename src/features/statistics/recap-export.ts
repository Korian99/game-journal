import { effectiveCoverUrl } from "@/lib/covers";

export function recapMonthName(month: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

export function recapTextLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = 3,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const [index, word] of words.entries()) {
    if (measure(word) > maxWidth) {
      if (line) {
        if (lines.length + 1 >= maxLines) {
          lines.push(ellipsize(line, maxWidth, measure));
          return lines;
        }
        lines.push(line);
      }
      lines.push(ellipsize(word, maxWidth, measure));
      return lines.slice(0, maxLines);
    }
    const candidate = line ? line + " " + word : word;
    if (line && measure(candidate) > maxWidth) {
      if (lines.length + 1 >= maxLines && index < words.length - 1) {
        lines.push(ellipsize(line, maxWidth, measure));
        return lines;
      }
      lines.push(line);
      if (lines.length >= maxLines) return lines;
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

function ellipsize(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  const chars = Array.from(text);
  while (chars.length && measure(chars.join("") + "…") > maxWidth) chars.pop();
  return chars.join("") + "…";
}

export type RecapPngInput = {
  year: number;
  month?: number;
  finishedPlaythroughs: number;
  uniqueGames: number;
  excludedDates: number;
  highlightTitle?: string;
  cover?: unknown;
  note?: string;
  includeNote?: boolean;
  theme: "light" | "dark";
};

function loadCover(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      resolve(undefined);
    }, 2500);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(undefined);
    };
    image.src = url;
  });
}

export async function createRecapPng(input: RecapPngInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  const dark = input.theme === "dark";
  const background = dark ? "#11130f" : "#ede5d8";
  const foreground = dark ? "#edece5" : "#332a21";
  const accent = dark ? "#e5bc6b" : "#a46b32";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(72, 72, 936, 12);

  const period = input.month
    ? new Intl.DateTimeFormat("es-AR", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(input.year, input.month - 1, 1)))
    : "Año";
  ctx.fillStyle = foreground;
  ctx.font = "bold 34px Georgia";
  ctx.fillText(
    (period + " · " + input.year).toLocaleUpperCase("es-AR"),
    82,
    154,
  );

  ctx.font = "bold 78px Georgia";
  const titleLines = recapTextLines(
    input.highlightTitle ||
      (input.month ? "Un mes de juegos" : "Un año de juegos"),
    600,
    (value) => ctx.measureText(value).width,
    3,
  );
  if (input.highlightTitle) {
    ctx.fillStyle = accent;
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText("MI DESTACADO", 82, 218);
    ctx.fillStyle = foreground;
    ctx.font = "bold 78px Georgia";
  }
  titleLines.forEach((line, index) => ctx.fillText(line, 82, 300 + index * 92));

  ctx.fillStyle = accent;
  ctx.font = "bold 110px Georgia";
  ctx.fillText(String(input.finishedPlaythroughs), 82, 670);
  ctx.fillStyle = foreground;
  ctx.font = "28px Trebuchet MS";
  ctx.fillText("partidas terminadas", 88, 720);
  ctx.font = "bold 58px Georgia";
  ctx.fillText(String(input.uniqueGames), 82, 845);
  ctx.font = "28px Trebuchet MS";
  ctx.fillText("juegos únicos terminados", 88, 890);
  ctx.font = "22px Trebuchet MS";
  const exclusions = input.excludedDates
    ? `${input.excludedDates} ${input.excludedDates === 1 ? "partida terminada sin fecha precisa" : "partidas terminadas sin fecha precisa"} (colección completa).`
    : "Todas las fechas de finalización estaban completas.";
  recapTextLines(
    exclusions,
    850,
    (value) => ctx.measureText(value).width,
    2,
  ).forEach((line, index) => ctx.fillText(line, 88, 972 + index * 32));

  const coverUrl = effectiveCoverUrl(input.cover);
  const cover = coverUrl ? await loadCover(coverUrl) : undefined;
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(710, 246, 270, 390, 16);
    ctx.clip();
    const scale = Math.max(270 / cover.width, 390 / cover.height);
    const width = cover.width * scale,
      height = cover.height * scale;
    ctx.drawImage(
      cover,
      710 + (270 - width) / 2,
      246 + (390 - height) / 2,
      width,
      height,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = dark ? "#22251e" : "#ddd2c1";
    ctx.beginPath();
    ctx.roundRect(710, 246, 270, 390, 16);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = "bold 28px Georgia";
    ctx.fillText("Un recuerdo", 750, 450);
  }

  if (input.includeNote && input.note?.trim()) {
    ctx.fillStyle = foreground;
    ctx.font = "italic 25px Trebuchet MS";
    recapTextLines(
      input.note,
      880,
      (value) => ctx.measureText(value).width,
      3,
    ).forEach((line, index) => ctx.fillText(line, 88, 1120 + index * 34));
  }
  ctx.fillStyle = accent;
  ctx.fillRect(72, 1268, 936, 3);
  ctx.fillStyle = foreground;
  ctx.font = "20px Trebuchet MS";
  ctx.fillText("MI DIARIO DE JUEGOS", 82, 1310);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG.")),
      "image/png",
    ),
  );
}
