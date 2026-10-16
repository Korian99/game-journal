"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";
export default function Password() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="center-page">
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const password = String(
            new FormData(e.currentTarget).get("password"),
          );
          const { error } = await browserClient().auth.updateUser({ password });
          if (error) {
            setError(
              "No se pudo actualizar la contraseña. Pedí un enlace nuevo.",
            );
            setBusy(false);
          } else window.location.assign("/");
        }}
      >
        <span className="eyebrow">GAME JOURNAL</span>
        <h1>Elegí tu contraseña.</h1>
        <label>
          Contraseña nueva
          <input
            type="password"
            name="password"
            minLength={8}
            pattern="(?=.*[A-Z])(?=.*[0-9]).{8,}"
            title="Al menos 8 caracteres, una mayúscula y un número."
            aria-describedby="password-requirements"
            required
            autoComplete="new-password"
          />
        </label>
        <p className="muted" id="password-requirements">
          Usá al menos 8 caracteres, una mayúscula y un número.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          Guardar y entrar
        </button>
      </form>
    </main>
  );
}
