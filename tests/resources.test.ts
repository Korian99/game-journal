import { expect, it, vi } from "vitest";
import * as resources from "../src/lib/api-client";
type Resource<T> = {
  load: () => Promise<void>;
  invalidate: () => void;
  getSnapshot: () => { data: T; status: string; error: string };
  setData: (value: T) => void;
};
const create = (
  resources as unknown as {
    createResource: <T>(initial: T, loader: () => Promise<T>) => Resource<T>;
  }
).createResource;
it("keeps the last data after refresh failure", async () => {
  expect(create).toBeTypeOf("function");
  if (!create) return;
  let fail = false;
  const r = create([1], async () => {
    if (fail) throw Error("unavailable");
    return [2];
  });
  await r.load();
  fail = true;
  await r.load();
  expect(r.getSnapshot()).toMatchObject({
    data: [2],
    status: "stale",
    error: "unavailable",
  });
});
it("coalesces overlapping loads", async () => {
  expect(create).toBeTypeOf("function");
  if (!create) return;
  let release!: (value: number[]) => void;
  const loader = vi.fn(
    () => new Promise<number[]>((resolve) => (release = resolve)),
  );
  const r = create([], loader);
  const first = r.load(),
    second = r.load();
  expect(loader).toHaveBeenCalledTimes(1);
  release([3]);
  await Promise.all([first, second]);
  expect(r.getSnapshot().data).toEqual([3]);
});
it("does not replace a canonical save with an older in-flight response", async () => {
  expect(create).toBeTypeOf("function");
  if (!create) return;
  let release!: (value: number[]) => void;
  const r = create(
    [],
    () => new Promise<number[]>((resolve) => (release = resolve)),
  );
  const loading = r.load();
  r.setData([9]);
  release([1]);
  await loading;
  expect(r.getSnapshot().data).toEqual([9]);
});
