import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { defaultGameThemeColor } from "@/features/library/game-theme-colors";
import {
  appearanceGameSchema,
  appearancePaletteSchema,
  appearanceResponseSchema,
  defaultAppearance,
  type Appearance,
  type AppearanceGame,
  type AppearancePatch,
} from "@/features/settings/appearance-contracts";

const endpoint = "/api/appearance";
type Session = { memberId: string; controller: AbortController; pending: Promise<void>; ready: boolean };

function readLegacyAppearance(memberId: string): Appearance {
  const mode = localStorage.getItem("journal-theme") === "light" ? "light" : "dark";
  const rawPalette = localStorage.getItem(`journal-custom-palette:${memberId}`);
  const rawGame = localStorage.getItem(`journal-library-cover:${memberId}`);
  let palette = null;
  let game = null;
  try { palette = appearancePaletteSchema.safeParse(JSON.parse(rawPalette ?? "null")).data ?? null; } catch {}
  try {
    game = appearanceGameSchema.safeParse(rawGame?.startsWith("{")
      ? JSON.parse(rawGame)
      : { entryId: rawGame, color: defaultGameThemeColor }).data ?? null;
  } catch {}
  return { mode, palette, game };
}

export function useMemberAppearance(memberId: string | undefined, onError: (message: string) => void) {
  const sessionRef = useRef<Session | null>(null);
  const [saved, setSaved] = useState<{ memberId: string; preferences: Appearance } | null>(null);
  const preferences = saved?.memberId === memberId ? saved?.preferences ?? defaultAppearance : defaultAppearance;

  async function request(session: Session, method: string, body?: unknown) {
    const signal = AbortSignal.any([session.controller.signal, AbortSignal.timeout(15000)]);
    const result = await apiRequest(endpoint, method, body, appearanceResponseSchema, signal);
    if (result.memberId !== session.memberId) throw Error("La sesión cambió.");
    return result.preferences;
  }

  async function initialize(session: Session) {
    let next = await request(session, "GET");
    if (!next) {
      let legacy = defaultAppearance;
      try { legacy = readLegacyAppearance(session.memberId); } catch {}
      next = await request(session, "PUT", { memberId: session.memberId, patch: legacy });
    }
    if (!next || session.controller.signal.aborted) return;
    session.ready = true;
    setSaved({ memberId: session.memberId, preferences: next });
    try {
      localStorage.removeItem("journal-theme");
      localStorage.removeItem(`journal-custom-palette:${session.memberId}`);
      localStorage.removeItem(`journal-library-cover:${session.memberId}`);
    } catch {}
  }

  useEffect(() => {
    if (!memberId) return;
    const session: Session = { memberId, controller: new AbortController(), pending: Promise.resolve(), ready: false };
    sessionRef.current = session;
    session.pending = initialize(session).catch(() => {
      if (!session.controller.signal.aborted) onError("No se pudo cargar la apariencia guardada.");
    });
    return () => {
      session.controller.abort();
      sessionRef.current = null;
    };
  }, [memberId]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", preferences.mode === "light");
  }, [preferences.mode]);

  function saveAppearance(patch: AppearancePatch, expectedGame?: AppearanceGame) {
    const session = sessionRef.current;
    if (!session || session.memberId !== memberId) return Promise.resolve(false);
    const task = session.pending.then(async () => {
      if (session.controller.signal.aborted) return false;
      if (!session.ready) await initialize(session);
      if (!session.ready) return false;
      const next = await request(session, "PATCH", { memberId: session.memberId, patch, expectedGame });
      if (!next || session.controller.signal.aborted) return false;
      setSaved({ memberId: session.memberId, preferences: next });
      return true;
    }).catch(() => {
      if (!session.controller.signal.aborted) onError("No se pudo guardar la apariencia. Volvé a intentarlo.");
      return false;
    });
    session.pending = task.then(() => {});
    return task;
  }

  return { preferences, saveAppearance };
}
