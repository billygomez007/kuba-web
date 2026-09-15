/**
 * Best-effort E.164-shaped phone normalization, without a phone-parsing
 * library — mirrors lib/outreach/suppression.ts's
 * normalizePhoneForSuppression exactly (same reasoning: no country-code
 * library is a dependency of this repo yet, and this is enough for
 * stable, safe matching across minor formatting differences). Kept as
 * its own small copy in lib/voice rather than importing from
 * lib/outreach — voice has no other dependency on the outreach module,
 * and phone normalization is a generic-enough utility that each channel
 * owning its own copy is clearer than a cross-channel import for one
 * function.
 */
export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}
