export const defaultGameThemeColor = "#a46b32";

export async function sampleCoverColors(url: string, signal: AbortSignal): Promise<string[]> {
  const response = await fetch(url, {
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) return [];
  const bitmap = await createImageBitmap(await response.blob(), { resizeWidth: 32, resizeHeight: 32 });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return [];
  }
  try {
    context.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }

  const pixels = context.getImageData(0, 0, 32, 32).data;
  const buckets = new Map<number, { count: number; red: number; green: number; blue: number }>();
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const [red, green, blue, alpha] = pixels.subarray(offset, offset + 4);
    const high = Math.max(red, green, blue);
    const low = Math.min(red, green, blue);
    if (alpha < 224 || high - low < 38 || high < 65 || low > 197) continue;
    const bucket = (red >> 6) * 16 + (green >> 6) * 4 + (blue >> 6);
    const sample = buckets.get(bucket) ?? { count: 0, red: 0, green: 0, blue: 0 };
    sample.count++;
    sample.red += red;
    sample.green += green;
    sample.blue += blue;
    buckets.set(bucket, sample);
  }
  return [...buckets.values()]
    .sort((first, second) => second.count - first.count)
    .slice(0, 3)
    .map(({ count, red, green, blue }) =>
      "#" + [red, green, blue].map((channel) => Math.round(channel / count).toString(16).padStart(2, "0")).join(""),
    );
}
