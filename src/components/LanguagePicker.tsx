import { LANGUAGES, type LanguageMode } from "@/shared/languages";

interface Props {
  value: LanguageMode;
  disabled: boolean;
  onChange: (mode: LanguageMode) => void;
}

/** Segmented control for the conversation language. */
export function LanguagePicker({ value, disabled, onChange }: Props) {
  return (
    <div className="w-full">
      <div className="mb-1 text-xs uppercase tracking-widest text-[var(--muted)]">Language</div>
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[var(--card-strong)] p-1" role="radiogroup" aria-label="Conversation language">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={value === l.id}
            disabled={disabled}
            onClick={() => onChange(l.id)}
            className={`rounded-xl px-2 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              value === l.id ? "bg-[var(--accent)] text-[#2a1a12]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Auto picks up your language from your first sentence and keeps it for the whole call.</p>
    </div>
  );
}
