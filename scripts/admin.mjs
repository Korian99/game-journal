import "./network.mjs";
import { writeFile } from "node:fs/promises";
const [mode, email] = process.argv.slice(2);
if (mode !== "bootstrap" || !email) {
  console.error(
    "Uso: npm run admin -- bootstrap correo. Para invitar, usá Configuración desde tu sesión administradora.",
  );
  process.exit(1);
}
const response = await fetch(
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/account-admin",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-setup-token": process.env.BOOTSTRAP_TOKEN ?? "",
    },
    body: JSON.stringify({
      email,
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }),
  },
);
const data = await response.json();
if (!response.ok) {
  console.error(data.error);
  process.exit(1);
}
await writeFile(".bootstrap-link.txt", data.link + "\n", { mode: 0o600 });
console.log(
  "Enlace privado guardado en .bootstrap-link.txt, ignorado por Git. Abrilo para elegir tu contraseña.",
);
