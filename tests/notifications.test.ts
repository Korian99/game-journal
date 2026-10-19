import { expect, it, vi, beforeEach } from "vitest";
import {
  allowedPushEndpoint,
  deliverPush,
  type Delivery,
} from "../supabase/functions/notification-worker/delivery";
import { enablePush } from "../src/lib/push-client";
const item: Delivery = {
  event_id: "event",
  subscription_id: "device",
  lease_token: "lease",
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/example",
    keys: { p256dh: "key", auth: "auth" },
  },
  title: "New discount",
  body: "USD 10",
  url: "/?tab=wishlist",
};
it("allows only trusted HTTPS push services without credentials or ports", () => {
  expect(allowedPushEndpoint(item.subscription.endpoint)).toBe(true);
  expect(allowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  for (const url of [
    "http://fcm.googleapis.com/a",
    "https://fcm.googleapis.com.evil.com/a",
    "https://x@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:444/a",
    "http://127.0.0.1",
    "garbage",
  ])
    expect(allowedPushEndpoint(url)).toBe(false);
});
it("finishes only the delivered device, including the deep link", async () => {
  const send = vi.fn().mockResolvedValue({});
  const finish = vi.fn().mockResolvedValue(undefined);
  expect(await deliverPush(item, { send, finish })).toBe("sent");
  expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({
    tag: "event",
    url: "/?tab=wishlist",
  });
  expect(finish).toHaveBeenCalledWith(item, "sent");
});
it("expires invalid subscriptions and retries temporary failures without claiming delivery", async () => {
  const finish = vi.fn().mockResolvedValue(undefined);
  for (const code of [404, 410]) {
    const send = vi.fn().mockRejectedValue({ statusCode: code });
    expect(await deliverPush(item, { send, finish })).toBe("expired");
  }
  const send = vi.fn().mockRejectedValue({ statusCode: 503 });
  expect(await deliverPush(item, { send, finish })).toBe("retry");
  expect(finish).toHaveBeenLastCalledWith(item, "retry");
  const invalid = {
    ...item,
    subscription: { endpoint: "https://127.0.0.1/private" },
  };
  send.mockClear();
  expect(await deliverPush(invalid, { send, finish })).toBe("expired");
  expect(send).not.toHaveBeenCalled();
});
it("requests permission before any network await, then subscribes using the active worker", async () => {
  const calls: string[] = [];
  const subscription = { endpoint: item.subscription.endpoint };
  const active = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  };
  vi.stubGlobal("window", { PushManager: function () {}, Notification: {} });
  vi.stubGlobal("Notification", {
    requestPermission: () => {
      calls.push("permission");
      return Promise.resolve("granted");
    },
  });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve(active),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      return Response.json(
        url === "/api/account" ? { vapidPublicKey: "AQID" } : { ok: true },
      );
    }),
  );
  await enablePush();
  expect(calls[0]).toBe("permission");
  expect(active.pushManager.subscribe).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

import { releaseNotificationDue } from "../src/lib/notification-release";
it("notifies only exact release dates since alerts were enabled, in Argentina time", () => {
  const now = new Date("2026-10-20T02:30:00Z"); // Still 19/10 in Argentina.
  const base = { year: null, releaseSince: "2026-10-19T12:00:00Z" };
  expect(releaseNotificationDue({ ...base, release: "2026-10-19" }, now)).toBe(
    true,
  );
  for (const release of ["2026-10-20", "2026-10-18", "2026", "2026-summer", ""])
    expect(releaseNotificationDue({ ...base, release }, now)).toBe(false);
  expect(
    releaseNotificationDue(
      {
        ...base,
        sourceSnapshot: {
          raw: { cells: [{ header: "Fecha de Salida", value: "2026-10-19" }] },
        },
      },
      now,
    ),
  ).toBe(true);
  expect(
    releaseNotificationDue(
      { ...base, release: "2026-10-19", releaseSince: "invalid" },
      now,
    ),
  ).toBe(false);
});

import fs from "node:fs";
import vm from "node:vm";
it("service worker opens the alert's app tab and rejects external URLs", async () => {
  const events: Record<string, any> = {};
  const show = vi.fn().mockResolvedValue(undefined);
  const open = vi.fn().mockResolvedValue(undefined);
  const sandbox = {
    URL,
    self: {
      location: { origin: "https://journal.example" },
      registration: { showNotification: show },
      addEventListener: (name: string, fn: any) => (events[name] = fn),
      clients: { matchAll: async () => [], openWindow: open },
    },
  };
  vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), sandbox);
  let task: Promise<unknown> = Promise.resolve();
  events.push({
    data: {
      json: () => ({ title: "Release", url: "/?tab=upcoming", tag: "event" }),
    },
    waitUntil: (p: Promise<unknown>) => (task = p),
  });
  await task;
  expect(show.mock.calls[0][1].data.url).toBe("/?tab=upcoming");
  events.notificationclick({
    notification: { close: () => {}, data: { url: "/?tab=upcoming" } },
    waitUntil: (p: Promise<unknown>) => (task = p),
  });
  await task;
  expect(open).toHaveBeenLastCalledWith(
    "https://journal.example/?tab=upcoming",
  );
  events.notificationclick({
    notification: { close: () => {}, data: { url: "//evil.example" } },
    waitUntil: (p: Promise<unknown>) => (task = p),
  });
  await task;
  expect(open).toHaveBeenLastCalledWith("https://journal.example/");
});

it("keeps the Edge release parser identical to the app parser", () => {
  for (const name of ["notification-release", "releases", "types"]) {
    const expected = fs
      .readFileSync("src/lib/" + name + ".ts", "utf8")
      .replaceAll('from "./releases"', 'from "./releases.ts"')
      .replaceAll('from "./types"', 'from "./types.ts"');
    expect(
      fs.readFileSync(
        "supabase/functions/notification-worker/" + name + ".ts",
        "utf8",
      ),
    ).toBe(expected);
  }
});
import ts from "typescript";
it("worker rejects unauthenticated and inactive callers before accessing the queue", async () => {
  let handler: (r: Request) => Promise<Response> = async () => new Response();
  const rpc = vi
    .fn()
    .mockResolvedValue({
      data: { game_journal_cron: "fixture-secret" },
      error: null,
    });
  const memberQuery: any = {
    select: () => memberQuery,
    eq: () => memberQuery,
    single: async () => ({ data: null }),
  };
  const db = {
    rpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => memberQuery,
  };
  const source = fs
    .readFileSync("supabase/functions/notification-worker/index.ts", "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  const sandbox = {
    Deno: { env: { get: () => "fixture" }, serve: (fn: any) => (handler = fn) },
    createClient: () => db,
    Response,
    Request,
  };
  vm.runInNewContext(code, sandbox);
  expect(
    (await handler(new Request("https://worker", { method: "POST" }))).status,
  ).toBe(401);
  expect(
    (await handler(new Request("https://worker", { method: "GET" }))).status,
  ).toBe(405);
  db.auth.getUser.mockResolvedValue({
    data: { user: { id: "inactive" } },
  } as any);
  expect(
    (
      await handler(
        new Request("https://worker", {
          method: "POST",
          headers: { Authorization: "Bearer inactive" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(rpc.mock.calls.every(([name]) => name === "worker_config")).toBe(true);
});
