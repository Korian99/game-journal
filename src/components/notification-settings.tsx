"use client";
import { useCallback, useEffect, useState } from "react";
import {
  enablePush,
  disablePush,
  pushDeviceState,
  testPush,
} from "@/lib/push-client";
type Preferences = { discounts: boolean; targets: boolean; releases: boolean };
export function NotificationSettings({ onChanged }: { onChanged: () => void }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [device, setDevice] = useState("loading");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [response, state] = await Promise.all([
        fetch("/api/notification-settings", { cache: "no-store" }),
        pushDeviceState().catch(() => "error"),
      ]);
      if (!response.ok) throw Error("No se pudieron cargar las preferencias.");
      const data = await response.json();
      if (
        ["discounts", "targets", "releases"].some(
          (key) => typeof data[key] !== "boolean",
        )
      )
        throw Error("No se pudieron cargar las preferencias.");
      setPreferences(data);
      setDevice(state);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setDevice("error");
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(key: keyof Preferences, value: boolean) {
    if (!preferences) return;
    const next = {
      discounts: preferences.discounts,
      targets: preferences.targets,
      releases: preferences.releases,
      [key]: value,
    };
    const previous = preferences;
    setPreferences(next);
    await action(async () => {
      try {
        const response = await fetch("/api/notification-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok)
          throw Error("No se pudieron guardar las preferencias.");
        setPreferences(await response.json());
      } catch (e) {
        setPreferences(previous);
        throw e;
      }
    });
  }

  const labels: Record<string, string> = {
    loading: "Comprobando este dispositivo…",
    on: "Activas en este dispositivo",
    off: "Inactivas en este dispositivo",
    blocked: "Bloqueadas en los permisos del navegador",
    unsupported:
      "Este navegador no admite notificaciones. Abrí la app instalada.",
    error: "No se pudo comprobar este dispositivo",
  };
  return (
    <section className="notification-settings" aria-label="Notificaciones">
      <h3>Notificaciones</h3>
      <p role="status">{labels[device]}</p>
      <div className="notification-options">
        {(
          [
            ["discounts", "Descuentos nuevos"],
            ["targets", "Descuentos por debajo de Objetivo"],
            ["releases", "Nuevos lanzamientos"],
          ] as const
        ).map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              checked={preferences?.[key] ?? false}
              disabled={busy || !preferences}
              onChange={(event) => save(key, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <p className="fine-print">
        Objetivo y los avisos por página se configuran en Páginas. Cada precio
        usa la moneda de esa página.
      </p>
      <div className="button-row">
        <button
          className="secondary"
          disabled={
            busy ||
            device === "on" ||
            device === "loading" ||
            device === "unsupported"
          }
          onClick={() =>
            action(async () => {
              await enablePush();
              setDevice(await pushDeviceState());
              setNotice("Notificaciones activadas en este dispositivo.");
            })
          }
        >
          Activar en este dispositivo
        </button>
        <button
          className="text-button"
          disabled={busy || device !== "on"}
          onClick={() =>
            action(async () => {
              await disablePush();
              setDevice("off");
              setNotice("Notificaciones desactivadas en este dispositivo.");
            })
          }
        >
          Desactivar
        </button>
        <button
          className="secondary"
          disabled={busy || device !== "on"}
          onClick={() =>
            action(async () => {
              setNotice(await testPush());
              onChanged();
            })
          }
        >
          Enviar prueba
        </button>
      </div>
      {error && (
        <p className="notification-feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notification-feedback" role="status">
          {notice}
        </p>
      )}
      <p className="fine-print">
        Precios: cada 3 h. Lanzamientos y envíos: cada 5 min.
      </p>
    </section>
  );
}
