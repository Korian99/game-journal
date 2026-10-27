"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { apiRequest, createResource } from "@/lib/api-client";
import {
  dataCheckDefaults,
  dataCheckStateSchema,
  type DataCheckState,
  dataCheckCommandSchema,
} from "@/lib/journal/data-checks";
import type { z } from "zod";
export type DataCheckCommand = z.infer<typeof dataCheckCommandSchema>;
export function useDataCheckState(online: boolean) {
  const resource = useMemo(
    () =>
      createResource<DataCheckState>(
        { preferences: dataCheckDefaults, dismissals: [] },
        () =>
          apiRequest(
            "/api/data-checks",
            "GET",
            undefined,
            dataCheckStateSchema,
          ),
      ),
    [],
  );
  const state = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  const pending = useRef(false);
  const [command, setCommand] = useState<DataCheckCommand | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      if (navigator.onLine) void resource.load();
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
    };
  }, [resource]);
  async function update(next: DataCheckCommand) {
    if (
      pending.current ||
      !online ||
      !navigator.onLine ||
      state.checkedAt === null
    )
      return;
    pending.current = true;
    setCommand(next);
    setError("");
    try {
      const result = await apiRequest(
        "/api/data-checks",
        "POST",
        next,
        dataCheckStateSchema,
      );
      resource.setData(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudieron guardar las preferencias.",
      );
    } finally {
      pending.current = false;
      setCommand(null);
    }
  }
  const preferences =
    command?.action === "preference"
      ? { ...state.data.preferences, [command.key]: command.enabled }
      : state.data.preferences;
  return { state, preferences, command, error, update, reload: resource.load };
}
