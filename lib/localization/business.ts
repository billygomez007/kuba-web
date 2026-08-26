import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, businessLocalization } from "@/db/schema";
import {
  DEFAULT_LOCALIZATION,
  isSupportedCountry,
  isSupportedCurrency,
  isValidTimezone,
  isValidLanguage,
  normalizeFreeTextCountry,
  resolveLocale,
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  type CountryCode,
  type CurrencyCode,
  type ResolvedLocalization,
} from "./registry";

/**
 * Resolves the authoritative localization for a business:
 * 1. A real business_localization row, if one has been saved (the canonical,
 *    already-migrated table this task wires up for the first time).
 * 2. Otherwise, best-effort derived from the free-text businesses.country
 *    field (set at onboarding historically), using that country's defaults.
 * 3. Otherwise, the platform-neutral default.
 *
 * countryCode never PERMANENTLY forces currency — step 2 only supplies an
 * initial suggestion; once a real row exists, it is always authoritative and
 * the business may run any supported currency regardless of country.
 */
export async function getBusinessLocalization(businessId: string): Promise<ResolvedLocalization> {
  const [row] = await db.select().from(businessLocalization).where(eq(businessLocalization.businessId, businessId)).limit(1);
  if (row) {
    const countryCode = isSupportedCountry(row.country) ? row.country : DEFAULT_LOCALIZATION.countryCode;
    const currencyCode = isSupportedCurrency(row.currencyCode) ? row.currencyCode : DEFAULT_LOCALIZATION.currencyCode;
    const timezone = isValidTimezone(row.timezone) ? row.timezone! : DEFAULT_LOCALIZATION.timezone;
    const language = isValidLanguage(row.language) ? row.language! : DEFAULT_LOCALIZATION.language;
    return { countryCode, currencyCode, timezone, language, locale: resolveLocale(language, countryCode) };
  }

  const [business] = await db.select({ country: businesses.country }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  const derivedCountry = normalizeFreeTextCountry(business?.country);
  if (derivedCountry) {
    const defaults = SUPPORTED_COUNTRIES[derivedCountry];
    return { countryCode: derivedCountry, currencyCode: defaults.defaultCurrency, timezone: defaults.defaultTimezone, language: "en", locale: defaults.defaultLocale };
  }

  return DEFAULT_LOCALIZATION;
}

export type LocalizationInput = { countryCode: string; currencyCode: string; timezone: string; language?: string };

export class InvalidLocalizationError extends Error {}

function validateLocalizationInput(input: LocalizationInput): { countryCode: CountryCode; currencyCode: CurrencyCode; timezone: string; language: string } {
  if (!isSupportedCountry(input.countryCode)) throw new InvalidLocalizationError(`Unsupported country code: ${input.countryCode}`);
  if (!isSupportedCurrency(input.currencyCode)) throw new InvalidLocalizationError(`Unsupported currency code: ${input.currencyCode}`);
  if (!isValidTimezone(input.timezone)) throw new InvalidLocalizationError(`Invalid timezone: ${input.timezone}`);
  const language = input.language && isValidLanguage(input.language) ? input.language.toLowerCase() : "en";
  return { countryCode: input.countryCode, currencyCode: input.currencyCode, timezone: input.timezone, language };
}

/** The first real write path for business_localization — validates every field server-side before persisting. */
export async function upsertBusinessLocalization(businessId: string, input: LocalizationInput): Promise<ResolvedLocalization> {
  const validated = validateLocalizationInput(input);
  const now = new Date();
  const [existing] = await db.select({ id: businessLocalization.id }).from(businessLocalization).where(eq(businessLocalization.businessId, businessId)).limit(1);

  const currencyName = SUPPORTED_CURRENCIES[validated.currencyCode].name;

  if (existing) {
    await db.update(businessLocalization).set({
      country: validated.countryCode,
      currency: currencyName,
      currencyCode: validated.currencyCode,
      language: validated.language,
      timezone: validated.timezone,
      updatedAt: now,
    }).where(eq(businessLocalization.businessId, businessId));
  } else {
    await db.insert(businessLocalization).values({
      id: crypto.randomUUID(),
      businessId,
      country: validated.countryCode,
      currency: currencyName,
      currencyCode: validated.currencyCode,
      language: validated.language,
      timezone: validated.timezone,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { ...validated, locale: resolveLocale(validated.language, validated.countryCode) };
}
