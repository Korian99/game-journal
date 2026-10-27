"use client";
import { useEffect, useId, useRef } from "react";

/** Back closes a local overlay, or restores its marker if closing was declined. */
export function useOverlayHistory(requestClose: () => boolean) {
  const token = useId();
  const latest = useRef(requestClose);
  const generation = useRef(0);
  useEffect(() => {
    latest.current = requestClose;
  });
  useEffect(() => {
    const run = ++generation.current;
    const url = window.location.href;
    const state = { ...window.history.state, journalOverlay: token };
    if (window.history.state?.journalOverlay)
      window.history.replaceState(state, "", url);
    else window.history.pushState(state, "", url);
    const back = () => {
      if (window.history.state?.journalOverlay === token) return;
      if (!latest.current()) window.history.pushState(state, "", url);
    };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      // React development mode can immediately reinstall the effect.
      queueMicrotask(() => {
        if (
          generation.current === run &&
          window.history.state?.journalOverlay === token
        )
          window.history.back();
      });
    };
  }, [token]);
}
