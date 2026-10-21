"use client";
interface PickerBuilder {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setCallback: (
    callback: (data: { action: string; docs?: { id: string }[] }) => void,
  ) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            error_callback: () => void;
            callback: (response: {
              error?: string;
              access_token: string;
            }) => void;
          }) => { requestAccessToken: (options: { prompt: string }) => void };
        };
      };
      picker: {
        PickerBuilder: new () => PickerBuilder;
        DocsView: new (view: string) => unknown;
        ViewId: { SPREADSHEETS: string };
      };
    };
    gapi: { load: (name: string, ready: () => void) => void };
  }
}
function script(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="' + src + '"]',
    ) as HTMLScriptElement | null;
    if (existing?.dataset.loaded) {
      resolve();
      return;
    }
    const e = existing ?? document.createElement("script");
    e.src = src;
    e.onload = () => {
      e.dataset.loaded = "1";
      resolve();
    };
    e.onerror = () => reject(Error("No se pudo conectar con Google"));
    if (!existing) document.head.append(e);
  });
}
export async function pickSpreadsheet(): Promise<{
  token: string;
  spreadsheetId: string;
}> {
  if (
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    !process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    !process.env.NEXT_PUBLIC_GOOGLE_APP_ID
  )
    throw Error("La importación de Google todavía no está habilitada.");
  await Promise.all([
    script("https://accounts.google.com/gsi/client"),
    script("https://apis.google.com/js/api.js"),
  ]);
  await new Promise<void>((r) => window.gapi.load("picker", r));
  return new Promise((resolve, reject) => {
    const oauth = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      scope: "https://www.googleapis.com/auth/drive.file",
      error_callback: () => reject(Error("Se canceló la conexión con Google")),
      callback: (response) => {
        if (response.error) {
          reject(Error("Google no autorizó el acceso"));
          return;
        }
        const token = response.access_token;
        const picker = new window.google.picker.PickerBuilder()
          .addView(
            new window.google.picker.DocsView(
              window.google.picker.ViewId.SPREADSHEETS,
            ),
          )
          .setOAuthToken(token)
          .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
          .setAppId(process.env.NEXT_PUBLIC_GOOGLE_APP_ID!)
          .setOrigin(window.location.origin)
          .setCallback((data) => {
            if (data.action === "picked" && data.docs?.[0])
              resolve({ token, spreadsheetId: data.docs[0].id });
            if (data.action === "cancel")
              reject(Error("Importación cancelada"));
          })
          .build();
        picker.setVisible(true);
      },
    });
    oauth.requestAccessToken({ prompt: "consent" });
  });
}
