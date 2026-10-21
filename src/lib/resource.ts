export type ResourceState<T> = {
  data: T;
  status: "idle" | "loading" | "ready" | "stale" | "error";
  error: string;
  checkedAt: number | null;
};
export function createResource<T>(initial: T, loader: () => Promise<T>) {
  let state: ResourceState<T> = {
      data: initial,
      status: "idle",
      error: "",
      checkedAt: null,
    },
    revision = 0,
    inFlight: Promise<void> | null = null,
    invalidated = false;
  const listeners = new Set<() => void>();
  const publish = (next: ResourceState<T>) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function load(): Promise<void> {
    if (inFlight) return inFlight;
    const started = revision;
    publish({
      ...state,
      status: "loading",
      error: "",
    });
    const operation = (async () => {
      try {
        const data = await loader();
        if (revision === started)
          publish({ data, status: "ready", error: "", checkedAt: Date.now() });
      } catch (error) {
        if (revision === started)
          publish({
            ...state,
            status: state.checkedAt === null ? "error" : "stale",
            error:
              error instanceof Error ? error.message : "No se pudo actualizar.",
          });
      }
    })();
    inFlight = operation;
    try {
      await operation;
    } finally {
      inFlight = null;
      if (invalidated) {
        invalidated = false;
        await load();
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    invalidate: () => {
      if (inFlight) {
        invalidated = true;
        revision++;
      } else void load();
    },
    setData: (data: T) => {
      revision++;
      publish({ data, status: "ready", error: "", checkedAt: Date.now() });
    },
  };
}
