import { mergeProviderCover, type Cover } from "../covers";

export function storeCoverSourcePages(savedPages: readonly string[]): string[] {
  return savedPages.filter((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.port || url.username || url.password)
        return false;
      if (url.hostname === "store.steampowered.com")
        return /^\/app\/\d+(?:\/|$)/.test(url.pathname);
      return (
        ["nintendo.com", "www.nintendo.com"].includes(url.hostname) &&
        /^\/(?:us|en-us|es-ar|en-ca|en-gb|es-es|es-mx|pt-br)\/store\/products\/[a-z0-9-]+\/?$/i.test(
          url.pathname,
        )
      );
    } catch {
      return false;
    }
  });
}

export type StoreCoverLookup = (url: string) => Promise<{ cover?: Cover }>;

export async function restoreStoreCover(
  current: Cover | undefined,
  savedPages: readonly string[],
  lookup: StoreCoverLookup,
): Promise<Cover | undefined> {
  for (const url of storeCoverSourcePages(savedPages)) {
    try {
      const preview = await lookup(url);
      const providerCover = mergeProviderCover(undefined, preview.cover);
      if (providerCover?.providerUrl) return providerCover;
    } catch {
      // A failed saved page should not prevent trying the next supported one.
    }
  }
  return current;
}
