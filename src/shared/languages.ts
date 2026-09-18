// Conversation language modes. "auto" follows the user, including mid-sentence code-switching.
export type LanguageMode = "auto" | "en" | "hi" | "ko" | "zh";

export const LANGUAGES: readonly { id: LanguageMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "ko", label: "한국어" },
];

export function isLanguageMode(v: unknown): v is LanguageMode {
  return v === "auto" || v === "en" || v === "hi" || v === "ko" || v === "zh";
}
