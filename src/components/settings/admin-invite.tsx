"use client";
import { apiRequest } from "@/lib/api-client";
import { invitationSchema } from "@/lib/contracts";
import { useState } from "react";

export function AdminInvite({ onError }: { onError: (s: string) => void }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await apiRequest(
            "/api/admin",
            "POST",
            { email },
            invitationSchema,
          );
          setLink(r.link);
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Correo de la persona invitada
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <button className="secondary" disabled={busy}>
        Generar enlace privado
      </button>
      {link && (
        <label>
          Compartilo únicamente con esa persona
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </form>
  );
}
