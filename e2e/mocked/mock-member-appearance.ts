import type { Page } from "@playwright/test";
import type { Appearance, AppearanceGame, AppearancePatch } from "../../src/features/settings/appearance-contracts";

export async function mockMemberAppearance(page: Page, getMemberId: () => string) {
  const stored = new Map<string, Appearance>();
  await page.route("**/api/appearance", async (route) => {
    const memberId = getMemberId();
    const previous = stored.get(memberId);
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { memberId, preferences: previous ?? null } });
    const { memberId: expectedMember, patch, expectedGame } = route.request().postDataJSON() as {
      memberId: string; patch: AppearancePatch; expectedGame?: AppearanceGame;
    };
    if (expectedMember !== memberId) return route.fulfill({ status: 409, json: { code: "SESSION_CHANGED" } });
    const gameMatches = !expectedGame ||
      (previous?.game?.entryId === expectedGame.entryId && previous.game.color === expectedGame.color);
    if ((method !== "PUT" || !previous) && gameMatches) {
      stored.set(memberId, { mode: "dark", palette: null, game: null, ...previous, ...patch });
    }
    return route.fulfill({ json: { memberId, preferences: stored.get(memberId) ?? null } });
  });
  return stored;
}
