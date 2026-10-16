"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";
export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
      window.location.assign("/");
    } catch {
      setError("No pudimos iniciar sesión. Revisá el correo y la contraseña.");
      setBusy(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <span className="eyebrow">VOLVÉ A TU PARTIDA</span>
      <h2>Bienvenido de vuelta.</h2>
      <p className="muted">Entrá a tu biblioteca personal.</p>
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
        Acceso por invitación. Si necesitás entrar o recuperar tu contraseña,
        pedile un enlace privado al administrador.
      </p>
    </form>
  );
}
