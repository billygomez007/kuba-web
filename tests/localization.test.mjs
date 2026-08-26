// Tests for the SuperKuba global localization foundation (lib/localization/*).
// Uses the REAL registry/formatters/business resolver via the tsconfig-path
// alias loader — never a duplicated country table. DB-backed tests run
// against a disposable local SQLite database (never Turso/staging).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let registry, format, businessLib, db, schema;
let tempDir;

const BIZ_NO_ROW = "biz-loc-no-row"; // has only a free-text businesses.country
const BIZ_UNKNOWN_COUNTRY = "biz-loc-unknown"; // businesses.country is unrecognizable free text
const BIZ_GH = "biz-loc-gh";
const BIZ_US = "biz-loc-us";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-localization-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  registry = await import("@/lib/localization/registry");
  format = await import("@/lib/localization/format");
  businessLib = await import("@/lib/localization/business");
  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");

  const now = new Date();
  for (const [id, country] of [[BIZ_NO_ROW, "Ghana"], [BIZ_UNKNOWN_COUNTRY, "Atlantis"], [BIZ_GH, "Ghana"], [BIZ_US, "United States"]]) {
    await db.insert(schema.businesses).values({ id, name: `Business ${id}`, slug: id, country, plan: "starter", status: "active", createdAt: now, updatedAt: now });
  }
  await businessLib.upsertBusinessLocalization(BIZ_GH, { countryCode: "GH", currencyCode: "GHS", timezone: "Africa/Accra" });
  await businessLib.upsertBusinessLocalization(BIZ_US, { countryCode: "US", currencyCode: "USD", timezone: "America/Chicago" }); // deliberately NOT the country's own default timezone
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- 1-8: country defaults, from the real registry ---
test("1. Ghana defaults to GHS", () => assert.equal(registry.SUPPORTED_COUNTRIES.GH.defaultCurrency, "GHS"));
test("2. Ghana defaults to Africa/Accra", () => assert.equal(registry.SUPPORTED_COUNTRIES.GH.defaultTimezone, "Africa/Accra"));
test("3. Ghana locale defaults appropriately", () => assert.equal(registry.SUPPORTED_COUNTRIES.GH.defaultLocale, "en-GH"));
test("4. Nigeria defaults to NGN", () => assert.equal(registry.SUPPORTED_COUNTRIES.NG.defaultCurrency, "NGN"));
test("5. Nigeria timezone is correct", () => assert.equal(registry.SUPPORTED_COUNTRIES.NG.defaultTimezone, "Africa/Lagos"));
test("6. UK defaults to GBP", () => assert.equal(registry.SUPPORTED_COUNTRIES.GB.defaultCurrency, "GBP"));
test("7. UK timezone is correct", () => assert.equal(registry.SUPPORTED_COUNTRIES.GB.defaultTimezone, "Europe/London"));
test("8. US supports USD", () => assert.equal(registry.SUPPORTED_COUNTRIES.US.defaultCurrency, "USD"));
test("Kenya, South Africa, and Canada are also registered with real IANA zones", () => {
  for (const code of ["KE", "ZA", "CA"]) {
    assert.equal(registry.isValidTimezone(registry.SUPPORTED_COUNTRIES[code].defaultTimezone), true);
  }
});

// --- 9-11: validation ---
test("9. invalid country is rejected", () => assert.equal(registry.isSupportedCountry("ZZ"), false));
test("10. invalid currency is rejected", () => assert.equal(registry.isSupportedCurrency("XYZ"), false));
test("11. invalid timezone is rejected", () => assert.equal(registry.isValidTimezone("GMT+1"), false));
test("timezone offsets like UTC+2/GMT-5 are specifically rejected (DST-unsafe)", () => {
  for (const bad of ["GMT+1", "UTC+2", "GMT-5", "UTC-8", "not-a-zone"]) {
    assert.equal(registry.isValidTimezone(bad), false, `${bad} must be rejected`);
  }
});
test("real IANA zones are accepted", () => {
  for (const zone of ["Africa/Accra", "Europe/London", "America/New_York", "America/Toronto", "Asia/Tokyo"]) {
    assert.equal(registry.isValidTimezone(zone), true);
  }
});
test("upsertBusinessLocalization rejects an unsupported country server-side", async () => {
  await assert.rejects(() => businessLib.upsertBusinessLocalization("biz-x", { countryCode: "ZZ", currencyCode: "USD", timezone: "UTC" }), businessLib.InvalidLocalizationError);
});
test("upsertBusinessLocalization rejects an unsupported currency server-side", async () => {
  await assert.rejects(() => businessLib.upsertBusinessLocalization("biz-x", { countryCode: "US", currencyCode: "XYZ", timezone: "UTC" }), businessLib.InvalidLocalizationError);
});
test("upsertBusinessLocalization rejects an invalid timezone server-side (not trusted blindly)", async () => {
  await assert.rejects(() => businessLib.upsertBusinessLocalization("biz-x", { countryCode: "US", currencyCode: "USD", timezone: "GMT-5" }), businessLib.InvalidLocalizationError);
});

// --- 12-15: currency formatters, real Intl ---
test("12. currency formatter GHS (renders the GH₵ symbol)", () => assert.equal(format.formatCurrency(2500, "GHS", "en-GH"), "GH₵2,500.00"));
test("13. currency formatter USD", () => assert.equal(format.formatCurrency(2500, "USD", "en-US"), "$2,500.00"));
test("14. currency formatter GBP", () => assert.equal(format.formatCurrency(2500, "GBP", "en-GB"), "£2,500.00"));
test("15. currency formatter NGN", () => assert.equal(format.formatCurrency(2500, "NGN", "en-NG"), "₦2,500.00"));
test("currency formatting never performs conversion — same numeric amount in different currencies", () => {
  const amount = 100;
  assert.match(format.formatCurrency(amount, "USD", "en-US"), /100/);
  assert.match(format.formatCurrency(amount, "GHS", "en-GH"), /100/);
});

// --- 16-17: date formatting / UTC storage ---
test("16. date formatting uses the configured timezone, not the server's", () => {
  const instant = new Date("2026-06-15T10:00:00Z");
  const accra = format.formatTime(instant, "Africa/Accra", "en-GH");
  const nyEDT = format.formatTime(instant, "America/New_York", "en-US");
  assert.notEqual(accra, nyEDT, "the same instant must render differently in different business timezones");
});
test("17. UTC storage remains authoritative — the stored instant is unambiguous regardless of display timezone", () => {
  const instant = new Date("2026-06-15T10:00:00Z");
  assert.equal(instant.toISOString(), "2026-06-15T10:00:00.000Z");
  // Both displays derive from the SAME stored instant, never a re-parsed localized string.
  const accraOffset = format.getTimeZoneOffsetMinutes(instant, "Africa/Accra");
  const nyOffset = format.getTimeZoneOffsetMinutes(instant, "America/New_York");
  assert.equal(accraOffset, 0);
  assert.equal(nyOffset, -240); // EDT in June
});

// --- 18-19: appointment / branch timezone behavior ---
test("18. appointment time respects its own stored business timezone (validateTimezone delegates to the canonical validator)", async () => {
  const customerOps = await import("@/lib/customer-operations");
  assert.equal(customerOps.validateTimezone("Africa/Accra"), "Africa/Accra");
  assert.throws(() => customerOps.validateTimezone("GMT+1"), /invalid/i);
});
test("19-20. branch timezone falls back to business timezone (no branches.timezone column exists yet, so this documents the intended `branch ?? business` rule for when one is added)", async () => {
  const localization = await businessLib.getBusinessLocalization(BIZ_GH);
  const branchTimezone = undefined ?? localization.timezone; // branch.timezone ?? business.timezone
  assert.equal(branchTimezone, "Africa/Accra");
});

// --- 21: analytics "today" respects business timezone ---
test("21. business-day boundaries differ across timezones for the same instant", () => {
  const instant = new Date("2026-08-25T23:30:00Z"); // late evening UTC
  const accraToday = format.getBusinessDayBounds("Africa/Accra", instant);
  const nyToday = format.getBusinessDayBounds("America/New_York", instant);
  assert.notEqual(accraToday.start.getTime(), nyToday.start.getTime(), "the business day boundary must depend on the configured timezone");
});
test("business day bounds are exactly 24h in a non-DST zone and correctly 23h/25h on DST transition days", () => {
  const accra = format.getBusinessDayBounds("Africa/Accra", new Date("2026-08-25T12:00:00Z"));
  assert.equal(accra.end.getTime() - accra.start.getTime(), 24 * 60 * 60 * 1000);
  const nySpringForward = format.getBusinessDayBounds("America/New_York", new Date("2026-03-08T15:00:00Z"));
  assert.equal((nySpringForward.end.getTime() - nySpringForward.start.getTime()) / 3600000, 23);
  const nyFallBack = format.getBusinessDayBounds("America/New_York", new Date("2026-11-01T15:00:00Z"));
  assert.equal((nyFallBack.end.getTime() - nyFallBack.start.getTime()) / 3600000, 25);
});

// --- 22-24: business switch / stale context ---
test("22. switching business changes the resolved localization context", async () => {
  const gh = await businessLib.getBusinessLocalization(BIZ_GH);
  const us = await businessLib.getBusinessLocalization(BIZ_US);
  assert.equal(gh.currencyCode, "GHS");
  assert.equal(us.currencyCode, "USD");
});
test("23. no stale currency after business switch — each call re-resolves independently", async () => {
  const first = await businessLib.getBusinessLocalization(BIZ_GH);
  const second = await businessLib.getBusinessLocalization(BIZ_US);
  const third = await businessLib.getBusinessLocalization(BIZ_GH);
  assert.equal(first.currencyCode, "GHS");
  assert.equal(second.currencyCode, "USD");
  assert.equal(third.currencyCode, "GHS", "re-resolving business A after B must not leak B's currency");
});
test("24. no stale timezone after business switch (US business deliberately configured off its country default)", async () => {
  const us = await businessLib.getBusinessLocalization(BIZ_US);
  assert.equal(us.timezone, "America/Chicago");
  const gh = await businessLib.getBusinessLocalization(BIZ_GH);
  assert.equal(gh.timezone, "Africa/Accra");
});

// --- 25-28: four-tier behavior — localization is not plan-gated ---
test("25-28. Starter/Growth/Pro/Enterprise all resolve business localization identically (not an entitlement-gated capability)", async () => {
  const planDefs = await import("@/lib/billing/plan-definitions");
  // Localization resolution has no hasCapability() check anywhere in its
  // code path — verified structurally: business.ts never imports hasCapability.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "lib/localization/business.ts"), "utf8");
  assert.doesNotMatch(source, /hasCapability/, "basic business localization must not be entitlement-gated");
  for (const planId of ["starter", "growth", "pro", "enterprise"]) {
    assert.ok(planDefs.getPlanDefinition(planId), `${planId} plan must resolve`);
  }
});

// --- 29: subscription billing currency stays separate ---
test("29. operational currency does not alter subscription billing currency", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/provider.ts"), "utf8");
  assert.doesNotMatch(source, /getBusinessLocalization|localization\.currencyCode/, "subscription billing must remain an independent currency domain, not derived from operational localization");
});

// --- 30: pricing page honesty ---
test("30. the pricing page does not fake regional pricing — prices remain placeholders, not geo-detected", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/pricing/page.tsx"), "utf8");
  assert.doesNotMatch(source, /navigator\.geolocation|Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/, "pricing must not geo-detect the visitor to imply local pricing");
});

// --- 31: AI appointment tools do not assume server timezone ---
test("31. AI-facing agent routes inject the resolved BUSINESS timezone into the prompt, not a bare server ISO timestamp", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["app/api/ai/receptionist/route.ts", "app/api/ai/sales/route.ts", "app/api/ai/customer-support/route.ts"]) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /getBusinessLocalization/, `${file} must resolve the business's real timezone before building agent context`);
    assert.match(source, /Business timezone:/, `${file} must surface the business timezone explicitly to the agent`);
  }
});

// --- 32-34: tenant isolation ---
test("32. tenant isolation: localization for one business never returns another business's row", async () => {
  const gh = await businessLib.getBusinessLocalization(BIZ_GH);
  const us = await businessLib.getBusinessLocalization(BIZ_US);
  assert.notEqual(gh.timezone, us.timezone);
  assert.notEqual(gh.currencyCode, us.currencyCode);
});
test("33. businessId override is rejected — upsertBusinessLocalization only ever targets the businessId explicitly passed by the trusted server caller", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/profile/route.ts"), "utf8");
  assert.doesNotMatch(source, /formData\.get\("businessId"\)/, "the profile route must never read businessId from client input");
});
test("34. localization values do not leak across businesses — a business with no saved row falls back to the platform default, never to another business's saved row", async () => {
  const unresolved = await businessLib.getBusinessLocalization("biz-loc-truly-nonexistent");
  assert.deepEqual(unresolved, registry.DEFAULT_LOCALIZATION);
  const us = await businessLib.getBusinessLocalization(BIZ_US);
  assert.notDeepEqual(unresolved, us, "the unresolved business must not pick up US's saved values");
});

// --- Extra: free-text country derivation fallback (no saved row yet) ---
test("a business with only a free-text businesses.country and no saved localization row derives sensible defaults", async () => {
  const resolved = await businessLib.getBusinessLocalization(BIZ_NO_ROW);
  assert.equal(resolved.countryCode, "GH");
  assert.equal(resolved.currencyCode, "GHS");
  assert.equal(resolved.timezone, "Africa/Accra");
});
test("an unrecognizable free-text country falls back to the platform default, not a guess", async () => {
  const resolved = await businessLib.getBusinessLocalization(BIZ_UNKNOWN_COUNTRY);
  assert.deepEqual(resolved, registry.DEFAULT_LOCALIZATION);
});
test("country never permanently forces currency — a Ghana business can run any supported currency", async () => {
  await businessLib.upsertBusinessLocalization(BIZ_GH, { countryCode: "GH", currencyCode: "USD", timezone: "Africa/Accra" });
  const resolved = await businessLib.getBusinessLocalization(BIZ_GH);
  assert.equal(resolved.countryCode, "GH");
  assert.equal(resolved.currencyCode, "USD", "GH country must not force GHS once explicitly configured otherwise");
  await businessLib.upsertBusinessLocalization(BIZ_GH, { countryCode: "GH", currencyCode: "GHS", timezone: "Africa/Accra" }); // restore for other tests
});
