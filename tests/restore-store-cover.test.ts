import { expect, it, vi } from "vitest";
import { restoreStoreCover } from "../src/features/stores/restore-store-cover";

const steam = "https://store.steampowered.com/app/620/Portal_2/";
const cover = {
  provider: "steam" as const,
  providerUrl:
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
};

it("restores the provider cover from a saved store page and clears the override", async () => {
  const lookup = vi.fn(async (url: string) => (url === steam ? { cover } : {}));
  const current = { overrideUrl: "https://assets.nintendo.com/custom.jpg" };
  const restored = await restoreStoreCover(current, [steam], lookup);
  expect(lookup).toHaveBeenCalledWith(steam);
  expect(restored).toEqual(cover);
});

it("keeps the current cover unchanged when saved pages have no provider image", async () => {
  const current = { overrideUrl: "https://assets.nintendo.com/custom.jpg" };
  const lookup = vi.fn(async () => ({}));
  expect(await restoreStoreCover(current, [steam], lookup)).toEqual(current);
});

it("skips saved pages outside Steam and Nintendo store product URLs", async () => {
  const lookup = vi.fn(async () => ({ cover }));
  await restoreStoreCover(
    undefined,
    ["https://example.org/game", steam],
    lookup,
  );
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(lookup).toHaveBeenCalledWith(steam);
});

it("tries the next saved store page after a lookup failure", async () => {
  const nintendo = "https://www.nintendo.com/us/store/products/test-switch/";
  const lookup = vi.fn(async (url: string) => {
    if (url === steam) throw new Error("temporary");
    return {
      cover: {
        provider: "nintendo" as const,
        providerUrl: "https://assets.nintendo.com/image/upload/recovered.jpg",
      },
    };
  });
  expect(await restoreStoreCover(undefined, [steam, nintendo], lookup)).toEqual(
    {
      provider: "nintendo",
      providerUrl: "https://assets.nintendo.com/image/upload/recovered.jpg",
    },
  );
  expect(lookup).toHaveBeenCalledTimes(2);
});
