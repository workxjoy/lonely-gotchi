import "server-only";
import type { Persona } from "@/shared/personas";

/**
 * Voice for a persona. Personal voice clones (created with `npm run voice:create`) stay out of the
 * repo: they are read from VOICE_<PERSONA_ID> in .env.local, e.g. VOICE_FAIRY_GODMOTHER=voice_...
 */
export function resolveVoice(persona: Persona): string {
  const override = process.env[`VOICE_${persona.id.toUpperCase().replace(/-/g, "_")}`]?.trim();
  return override?.startsWith("voice_") ? override : persona.voice;
}
