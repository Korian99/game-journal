"use client";
export async function enablePush() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw Error("Este navegador no admite notificaciones.");
  if ((await Notification.requestPermission()) !== "granted")
    throw Error(
      "Podés habilitar las notificaciones en los permisos del navegador.",
    );
  const response = await fetch("/api/account");
  if (!response.ok) throw Error("Volvé a iniciar sesión.");
  const { vapidPublicKey: key } = await response.json();
  if (!key) throw Error("Las notificaciones todavía no están habilitadas.");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  const r = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!r.ok) throw Error("No se pudo guardar la suscripción.");
}
export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await registration?.pushManager.getSubscription();
  if (sub) {
    const r = await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!r.ok) throw Error("No se pudo desactivar la suscripción.");
    await sub.unsubscribe();
  }
}

async function deviceEndpoint() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (registration) void registration.update().catch(() => {});
  return (await registration?.pushManager.getSubscription())?.endpoint ?? null;
}
export async function pushDeviceState(): Promise<
  "on" | "off" | "blocked" | "unsupported"
> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const endpoint = await deviceEndpoint();
  if (!endpoint) return "off";
  const response = await fetch("/api/notification-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", endpoint }),
  });
  if (!response.ok) throw Error("No se pudo comprobar este dispositivo.");
  return (await response.json()).subscribed ? "on" : "off";
}
export async function testPush() {
  const endpoint = await deviceEndpoint();
  if (!endpoint) throw Error("Activá las notificaciones primero.");
  const response = await fetch("/api/notification-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", endpoint }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "No se pudo enviar la prueba.");
  return result.sent
    ? "Prueba enviada al servicio de notificaciones."
    : "Prueba en cola. Puede tardar hasta 5 minutos.";
}
