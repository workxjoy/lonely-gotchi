import { PERSONAS, type PersonaId } from "@/shared/personas";

interface Props {
  selected: PersonaId;
  disabled: boolean;
  onSelect: (id: PersonaId) => void;
}

export function PersonaPicker({ selected, disabled, onSelect }: Props) {
  return (
    <div className="grid w-full gap-2">
      {PERSONAS.map((p) => {
        const active = p.id === selected;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              active
                ? "border-[var(--accent)] bg-[var(--card-strong)]"
                : "border-transparent bg-[var(--card)] hover:bg-[var(--card-strong)]"
            } ${disabled && !active ? "opacity-40" : ""}`}
          >
            <div className="font-semibold">{p.name}</div>
            <div className="text-sm text-[var(--muted)]">{p.tagline}</div>
            <div className="mt-1 text-xs text-[var(--accent)]">Voice: {p.voiceName}</div>
          </button>
        );
      })}
    </div>
  );
}
