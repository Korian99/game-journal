"use client";
export async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw Error("Este navegador no admite notificaciones.");
  const response = await fetch("/api/account");
  if (!response.ok) throw Error("Volvé a iniciar sesión.");
  const { vapidPublicKey: key } = await response.json();
  if (!key) throw Error("Las notificaciones todavía no están habilitadas.");
  if ((await Notification.requestPermission()) !== "granted")
    throw Error(
      "Podés habilitar las notificaciones en los permisos del navegador.",
    );
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
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
