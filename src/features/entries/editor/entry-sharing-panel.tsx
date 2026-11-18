import { Share2 } from "lucide-react";
import type { EditorContext } from "./editor-context";

export function EntrySharingPanel({
  online,
  members,
  grants,
  recipientId,
  onRecipientChange,
  onRevoke,
  onShare,
}: Pick<EditorContext, "online" | "members" | "grants" | "recipientId"> & {
  onRecipientChange: (value: string) => void;
  onRevoke: (grantId: string) => void;
  onShare: () => void;
}) {
  return (
    <section className="editor-section">
      <h3>
        <Share2 size={16} />
        Compartir esta entrada
      </h3>
      <p className="muted">
        Se comparten la partida, las horas, las puntuaciones y las impresiones.
        Motivos y comentarios: privados.
      </p>
      {grants.map((g) => (
        <div className="button-row" key={g.id}>
          <span>
            {members.find((m) => m.id === g.recipient_id)?.display_name ??
              "Persona invitada"}
          </span>
          <button
            className="text-button"
            disabled={!online}
            onClick={() => onRevoke(g.id)}
          >
            Revocar acceso
          </button>
        </div>
      ))}
      <div className="inline-form">
        <select
          disabled={!online}
          aria-label="Compartir con"
          value={recipientId}
          onChange={(e) => onRecipientChange(e.target.value)}
        >
          <option value="">Elegí una persona</option>
          {members
            .filter((m) => !grants.some((g) => g.recipient_id === m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
        </select>
        <button
          className="secondary"
          disabled={!recipientId || !online}
          onClick={onShare}
        >
          Compartir
        </button>
      </div>
    </section>
  );
}
