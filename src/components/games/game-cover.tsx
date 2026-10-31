"use client";

import { useState } from "react";
import { effectiveCoverUrl } from "@/lib/covers";
import type { Cover } from "@/lib/covers";

export function GameRowArtwork({
  cover,
  wide = false,
}: {
  cover?: Cover;
  wide?: boolean;
}) {
  const url = effectiveCoverUrl(cover);
  const [failedUrl, setFailedUrl] = useState("");
  if (!url || failedUrl === url) return null;
  return (
    <span
      className={`game-row-art${wide ? " game-row-art-wide" : ""}`}
      aria-hidden="true"
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}

export function GameCover({
  cover,
  title,
  size = "thumb",
}: {
  cover?: Cover;
  title: string;
  size?: "thumb" | "card" | "feature";
}) {
  const url = effectiveCoverUrl(cover);
  const [failedUrl, setFailedUrl] = useState("");
  const failed = !!url && failedUrl === url;
  if (!url || failed) return null;
  return (
    <span className={`game-cover game-cover-${size}`}>
      <img
        src={url}
        alt={`Portada de ${title}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}
