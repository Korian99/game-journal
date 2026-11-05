"use client";
import { useState } from "react";
import { resolveJournalReturnPath } from "@/lib/journal/journal-location";
import { browserClient } from "@/lib/supabase/client";
export function LoginForm() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
      window.location.assign(
        resolveJournalReturnPath(
          new URLSearchParams(window.location.search).get("next"),
        ),
      );
    } catch {
      setError(
        "No pudimos iniciar sesión. Revisá la conexión, el correo y la contraseña.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <h2>Iniciar sesión</h2>
      <label>
        Correo electrónico
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="vos@ejemplo.com"
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Entrando…" : "Entrar al diario"} <span>↗</span>
      </button>
      <p className="fine-print">
        Pedí un enlace al administrador para entrar o recuperar tu cuenta.
      </p>
    </form>
  );
}
