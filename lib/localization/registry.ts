/**
 * Canonical, pure (no DB, no Next.js) localization registry and validators.
 *
 * This is the single source of truth for which countries/currencies SuperKuba
 * currently supports with curated defaults, and for validating country,
 * currency, timezone, and locale values anywhere in the app. Country and
 * currency are validated against a curated, supported set (not "any ISO
 * code") because they carry real defaults and real money semantics.
 * Timezone and locale are validated structurally via Intl, since any valid
 * IANA zone / BCP-47 tag is safe to accept without a hand-maintained list.
 */

export type CountryCode = "GH" | "US" | "GB" | "NG" | "KE" | "ZA" | "CA";
export type CurrencyCode = "GHS" | "USD" | "GBP" | "NGN" | "KES" | "ZAR" | "CAD" | "EUR";

export type CountryDefinition = {
  code: CountryCode;
  name: string;
  defaultCurrency: CurrencyCode;
  /**
   * An initialization SUGGESTION only. Countries spanning multiple zones
   * (US, CA) get one reasonable default; the business can select any valid
   * IANA zone afterward — this is never treated as authoritative.
   */
  defaultTimezone: string;
  defaultLocale: string;
};

export const SUPPORTED_COUNTRIES: Record<CountryCode, CountryDefinition> = {
  GH: { code: "GH", name: "Ghana", defaultCurrency: "GHS", defaultTimezone: "Africa/Accra", defaultLocale: "en-GH" },
  US: { code: "US", name: "United States", defaultCurrency: "USD", defaultTimezone: "America/New_York", defaultLocale: "en-US" },
  GB: { code: "GB", name: "United Kingdom", defaultCurrency: "GBP", defaultTimezone: "Europe/London", defaultLocale: "en-GB" },
  NG: { code: "NG", name: "Nigeria", defaultCurrency: "NGN", defaultTimezone: "Africa/Lagos", defaultLocale: "en-NG" },
  KE: { code: "KE", name: "Kenya", defaultCurrency: "KES", defaultTimezone: "Africa/Nairobi", defaultLocale: "en-KE" },
  ZA: { code: "ZA", name: "South Africa", defaultCurrency: "ZAR", defaultTimezone: "Africa/Johannesburg", defaultLocale: "en-ZA" },
  CA: { code: "CA", name: "Canada", defaultCurrency: "CAD", defaultTimezone: "America/Toronto", defaultLocale: "en-CA" },
};

export const COUNTRY_ORDER: CountryCode[] = ["GH", "US", "GB", "NG", "KE", "ZA", "CA"];

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, { name: string }> = {
  GHS: { name: "Ghanaian Cedi" },
  USD: { name: "US Dollar" },
  GBP: { name: "British Pound" },
  NGN: { name: "Nigerian Naira" },
  KES: { name: "Kenyan Shilling" },
  ZAR: { name: "South African Rand" },
  CAD: { name: "Canadian Dollar" },
  EUR: { name: "Euro" },
};

export const CURRENCY_ORDER: CurrencyCode[] = ["GHS", "USD", "GBP", "NGN", "KES", "ZAR", "CAD", "EUR"];

/** A short, non-exhaustive list of common IANA zones for building a <select>. Any valid IANA zone is still accepted server-side via isValidTimezone. */
export const COMMON_TIMEZONES: string[] = [
  "Africa/Accra", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Vancouver", "America/Sao_Paulo",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

export function isSupportedCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && value in SUPPORTED_COUNTRIES;
}

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in SUPPORTED_CURRENCIES;
}

/** True IANA-zone validation via Intl — accepts any valid zone, not just the curated list. */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** True BCP-47 locale validation via Intl — accepts any well-formed, Intl-resolvable locale. */
export function isValidLocale(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat(value);
    return true;
  } catch {
    return false;
  }
}

/** IETF base-language subtag, e.g. "en", "fr" — a coarser, storable preference distinct from a full locale. */
export function isValidLanguage(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2,3}$/i.test(value.trim());
}

/** Derives a BCP-47 locale like "en-GH" from a base language + country, falling back to the country's default locale, then the bare language. */
export function resolveLocale(language: string | null | undefined, countryCode: CountryCode | string | null | undefined): string {
  if (countryCode && isSupportedCountry(countryCode) && language && isValidLanguage(language)) {
    const candidate = `${language.toLowerCase()}-${countryCode.toUpperCase()}`;
    if (isValidLocale(candidate)) return candidate;
  }
  if (countryCode && isSupportedCountry(countryCode)) return SUPPORTED_COUNTRIES[countryCode].defaultLocale;
  if (language && isValidLanguage(language)) return language.toLowerCase();
  return DEFAULT_LOCALIZATION.locale;
}

export type ResolvedLocalization = {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  timezone: string;
  language: string;
  locale: string;
};

/**
 * Platform-neutral fallback used only when a business has no localization
 * row and no recognizable free-text country to derive one from. Matches the
 * pre-existing product default already encoded in db/schema.ts's
 * business_localization.timezone column default ("Africa/Accra") and the
 * onboarding flow's historical "Ghana" default — kept for continuity rather
 * than introducing a new, inconsistent default.
 */
export const DEFAULT_LOCALIZATION: ResolvedLocalization = {
  countryCode: "GH",
  currencyCode: "GHS",
  timezone: "Africa/Accra",
  language: "en",
  locale: "en-GH",
};

/** Maps common free-text country names (as historically typed into businesses.country) to a supported ISO code. Best-effort only. */
const FREE_TEXT_COUNTRY_ALIASES: Record<string, CountryCode> = {
  ghana: "GH",
  "united states": "US", "united states of america": "US", usa: "US", "u.s.a.": "US", "u.s.": "US",
  "united kingdom": "GB", uk: "GB", "u.k.": "GB", england: "GB", britain: "GB",
  nigeria: "NG",
  kenya: "KE",
  "south africa": "ZA",
  canada: "CA",
};

export function normalizeFreeTextCountry(value: string | null | undefined): CountryCode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (isSupportedCountry(value.trim().toUpperCase())) return value.trim().toUpperCase() as CountryCode;
  return FREE_TEXT_COUNTRY_ALIASES[normalized] ?? null;
}
