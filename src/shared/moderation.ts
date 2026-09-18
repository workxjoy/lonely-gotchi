// Abuse filter applied to every user utterance (spoken transcript or typed), client and server side.
// Boson Realtime has no built-in moderation; its docs point to input transcripts for this.

// Latin-script terms (English + romanized Hindi), matched as whole words.
const LATIN = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bitch", "bastard", "asshole", "cunt", "dick",
  "slut", "whore", "retard",
  "chutiya", "chutiye", "madarchod", "maderchod", "behenchod", "bhenchod", "bhosdike", "bhosdi", "bsdk",
  "gandu", "harami", "randi", "lodu", "lauda", "lavda",
];
// Devanagari, Chinese and Korean terms, matched as substrings (\b does not work for these scripts).
const DEVANAGARI = ["씨발", "시발", "개새끼", "병신", "좆", "傻逼", "他妈的", "操你妈", "草泥马", "贱人", "चूतिया", "चुतिया", "मादरचोद", "बहनचोद", "भेनचोद", "भोसड़ी", "भोसडी", "गांडू", "हरामी", "रंडी", "लौड़ा", "लवड़ा"];

const latinPattern = new RegExp(`\\b(${LATIN.join("|")})\\b`, "gi");

/** Returns the first abusive term found, or null. */
export function findAbuse(text: string): string | null {
  const latin = text.match(latinPattern);
  if (latin) return latin[0];
  return DEVANAGARI.find((w) => text.includes(w)) ?? null;
}

/** Masks abusive terms for captions and stored transcripts. */
export function redactAbuse(text: string): string {
  let out = text.replace(latinPattern, (w) => "*".repeat(w.length));
  for (const w of DEVANAGARI) out = out.split(w).join("*".repeat(w.length));
  return out;
}

export const ABUSE_MESSAGE =
  "Call ended: abusive language detected. lonely-gotchi is here to support you, but it won't respond to abuse.";
