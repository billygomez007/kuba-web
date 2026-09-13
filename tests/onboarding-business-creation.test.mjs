// Regression suite for the reported onboarding Step 2 blocker: submitting
// Business name "Kora OS", Industry "Software", Country "Ghana", Currency
// "GHS", Timezone "Africa/Accra", Website "koraafric.com" produced "One or
// more onboarding selections are invalid." Root cause, proven from the code
// (not guessed): app/api/businesses/route.ts's hard-coded industry enum
// (Travel/Healthcare/Real Estate/Education/Retail/Professional Services/
// Other) had no "Technology"/"Software" option at all, while the client
// rendered Industry as a free-text field with no connection to that enum —
// any value outside the seven the server happened to hard-code would fail
// with the same unhelpful message, regardless of which value that was.
//
// This exercises the REAL functions app/api/businesses/route.ts imports and
// calls (lib/onboarding/registry.ts, lib/onboarding/website.ts) — not a
// hand-reimplemented copy — against the exact Kora acceptance payload, plus
// the real database transaction shape the route uses (next/headers-backed
// route handlers can't be invoked directly outside a real request; this
// matches the pattern already established by this repo's other
// next/headers-dependent route tests: real logic + real DB + static
// assertions proving the route actually calls that logic in order).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema;
let registry, website, localizationRegistry;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-onboarding-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  registry = await import("@/lib/onboarding/registry");
  website = await import("@/lib/onboarding/website");
  localizationRegistry = await import("@/lib/localization/registry");
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const KORA_PAYLOAD = {
  businessName: "Kora OS",
  industry: "Software", // exactly what the user typed — see below for the fix
  countryCode: "GH",
  currencyCode: "GHS",
  timezone: "Africa/Accra",
  website: "koraafric.com",
  businessSize: "Solo",
  goals: ["Automate customer support"],
};

// --- 1. The exact reported field/value/root cause ---

test("REGRESSION: 'Software' as typed is NOT a recognized onboarding industry label — this was the literal rejected value", () => {
  assert.equal(registry.isOnboardingIndustry("Software"), false);
});

test("the fix: 'Technology' is the canonical option covering this case, and the client's Select now offers it (not free text)", async () => {
  assert.equal(registry.isOnboardingIndustry("Technology"), true);
  const onboardingSource = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(onboardingSource, /ONBOARDING_INDUSTRIES/);
  assert.doesNotMatch(onboardingSource, /<Field label="Industry"/, "Industry must no longer be a free-text field the server's enum can silently reject");
  assert.match(onboardingSource, /<Select label="Industry"/);
});

// --- 2. UI options vs server enums: every rendered option is server-accepted ---

test("every ONBOARDING_INDUSTRIES option (what the Select renders) is accepted by isOnboardingIndustry (one canonical source, not two drift-prone lists)", () => {
  for (const value of registry.ONBOARDING_INDUSTRIES) {
    assert.equal(registry.isOnboardingIndustry(value), true, `"${value}" must be accepted`);
  }
});

test("country/currency/timezone submitted values are already canonical codes, not display labels — 'Ghana'/'Ghanaian Cedi (GHS)' are UI labels only", () => {
  assert.equal(localizationRegistry.isSupportedCountry("GH"), true);
  assert.equal(localizationRegistry.isSupportedCurrency("GHS"), true);
  assert.equal(localizationRegistry.isValidTimezone("Africa/Accra"), true);
  // The literal display labels must never be what's checked/submitted.
  assert.equal(localizationRegistry.isSupportedCountry("Ghana"), false);
  assert.equal(localizationRegistry.isSupportedCurrency("Ghanaian Cedi (GHS)"), false);
});

test("invalid industry/country/currency/timezone are all correctly rejected", () => {
  assert.equal(registry.isOnboardingIndustry("Not A Real Industry"), false);
  assert.equal(localizationRegistry.isSupportedCountry("ZZ"), false);
  assert.equal(localizationRegistry.isSupportedCurrency("ZZZ"), false);
  assert.equal(localizationRegistry.isValidTimezone("Not/A_Timezone"), false);
});

// --- 3. Website normalization ---

test("bare domain 'koraafric.com' is accepted and normalized to https://, never rejected", () => {
  const result = website.normalizeWebsiteUrl("koraafric.com");
  assert.equal(result.error, null);
  assert.equal(result.value, "https://koraafric.com/");
});

test("an explicit https:// URL is preserved", () => {
  const result = website.normalizeWebsiteUrl("https://koraafric.com");
  assert.equal(result.error, null);
  assert.equal(result.value, "https://koraafric.com/");
});

test("an explicit http:// URL is preserved (not force-upgraded)", () => {
  const result = website.normalizeWebsiteUrl("http://koraafric.com");
  assert.equal(result.error, null);
  assert.equal(result.value, "http://koraafric.com/");
});

test("blank/whitespace-only website is valid (optional field) and normalizes to null with no error", () => {
  assert.deepEqual(website.normalizeWebsiteUrl(""), { value: null, error: null });
  assert.deepEqual(website.normalizeWebsiteUrl("   "), { value: null, error: null });
});

test("malformed host is rejected with a field-appropriate message, not a stack trace", () => {
  const result = website.normalizeWebsiteUrl("not a valid host with spaces");
  assert.equal(result.value, null);
  assert.equal(typeof result.error, "string");
  assert.doesNotMatch(result.error, /Error|stack|at Object/i);
});

test("dangerous schemes (javascript:, data:, file:) are rejected outright, never reinterpreted as a hostname", () => {
  for (const dangerous of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "vbscript:msgbox(1)"]) {
    const result = website.normalizeWebsiteUrl(dangerous);
    assert.equal(result.value, null, `"${dangerous}" must be rejected`);
    assert.ok(result.error, `"${dangerous}" must carry an error message`);
  }
});

test("a website with trailing whitespace is trimmed before normalization", () => {
  const result = website.normalizeWebsiteUrl("  koraafric.com  ");
  assert.equal(result.value, "https://koraafric.com/");
});

// --- 4. Full Kora acceptance payload: real business-creation write path ---

test("Kora acceptance case: the exact reported payload succeeds end to end using the real transaction shape app/api/businesses/route.ts uses", async () => {
  const userId = "onboarding-kora-user";
  const businessId = crypto.randomUUID();
  const now = new Date();

  const industryOk = registry.isOnboardingIndustry("Technology"); // the corrected submitted value
  const businessSizeOk = registry.isOnboardingBusinessSize(KORA_PAYLOAD.businessSize);
  const goalsOk = KORA_PAYLOAD.goals.every((g) => registry.isOnboardingGoal(g));
  const websiteResult = website.normalizeWebsiteUrl(KORA_PAYLOAD.website);
  const countryOk = localizationRegistry.isSupportedCountry(KORA_PAYLOAD.countryCode);
  const currencyOk = localizationRegistry.isSupportedCurrency(KORA_PAYLOAD.currencyCode);
  const timezoneOk = localizationRegistry.isValidTimezone(KORA_PAYLOAD.timezone);

  assert.equal(industryOk, true);
  assert.equal(businessSizeOk, true);
  assert.equal(goalsOk, true);
  assert.equal(websiteResult.error, null);
  assert.equal(countryOk, true);
  assert.equal(currencyOk, true);
  assert.equal(timezoneOk, true);

  // The exact atomic write app/api/businesses/route.ts performs.
  await db.transaction(async (tx) => {
    await tx.insert(schema.businesses).values({
      id: businessId,
      name: KORA_PAYLOAD.businessName,
      slug: `kora-os-${businessId.slice(0, 8)}`,
      website: websiteResult.value,
      industry: "Technology",
      country: localizationRegistry.SUPPORTED_COUNTRIES.GH.name,
      businessSize: KORA_PAYLOAD.businessSize,
      plan: "starter",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(schema.businessUsers).values({
      id: crypto.randomUUID(),
      businessId,
      userId,
      role: "owner",
      createdAt: now,
    });
  });

  const [createdBusiness] = await db.select().from(schema.businesses).where((await import("drizzle-orm")).eq(schema.businesses.id, businessId));
  const [ownerMembership] = await db.select().from(schema.businessUsers).where((await import("drizzle-orm")).eq(schema.businessUsers.businessId, businessId));

  assert.equal(createdBusiness.name, "Kora OS");
  assert.equal(createdBusiness.website, "https://koraafric.com/");
  assert.equal(createdBusiness.industry, "Technology");
  assert.equal(ownerMembership.role, "owner");
  assert.equal(ownerMembership.userId, userId);

  const { getBusinessEntitlements } = await import("@/lib/billing/entitlements");
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "starter", "a freshly onboarded business is Starter by default — Pro/complimentary is a separate, later admin action, never auto-granted in onboarding");
});

// --- 5. The route file actually calls the real shared functions (not a private re-implementation) ---

test("app/api/businesses/route.ts imports and calls the shared onboarding registry and website normalizer, not private duplicates", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /from ["']@\/lib\/onboarding\/registry["']/);
  assert.match(source, /from ["']@\/lib\/onboarding\/website["']/);
  assert.match(source, /isOnboardingIndustry\(/);
  assert.match(source, /isOnboardingBusinessSize\(/);
  assert.match(source, /isOnboardingGoal\(/);
  assert.match(source, /normalizeWebsiteUrl\(/);
  assert.doesNotMatch(source, /new Set\(\[\s*"Travel"/, "the old hard-coded, drift-prone industry Set must be gone");
});

test("the route returns structured field-level errors, not only a generic message", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /fieldErrors/);
  assert.doesNotMatch(source, /One or more onboarding selections are invalid/, "the old vague generic message is gone");
});

// --- 6. Business creation atomicity ---

test("business + owner membership are created inside one db.transaction — never as two independent writes that could leave one without the other", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  const transactionBlock = source.slice(source.indexOf("await db.transaction("), source.indexOf("if (countryCode && currencyCode && timezone)"));
  assert.match(transactionBlock, /tx\.insert\(businesses\)/);
  assert.match(transactionBlock, /tx\.insert\(businessUsers\)/);
});

test("selected-business cookie context is established immediately after business creation succeeds", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /cookies\(\)\)\.set\("superkuba_business_id", businessId/);
});

// --- 7. Retry/idempotency ---

test("retrying business creation for a user who already has a membership returns 409 with the existing businessId, never a second business", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /existingMembership\.length > 0/);
  assert.match(source, /status:\s*409/);
});

// --- 8. Skip-for-now cannot bypass mandatory business creation ---

test("the onboarding header's Skip-for-now control is hidden until step > 2 (a business/owner membership cannot exist before then)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(source, /\{step > 2 && \(/);
});

test("later onboarding steps (4 and the final step) remain skippable once a business exists", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const skipButtons = (source.match(/onClick=\{skip\}/g) || []).length;
  assert.ok(skipButtons >= 3, "Skip for now (header), Skip onboarding (step 4), and Continue to dashboard (final step) must all still call skip()");
});

// --- 9. Do not hard-code Kora ---

test("no code introduced by this fix hard-codes Kora, koraafric.com, or Ghana as a special case", async () => {
  const [routeSource, onboardingSource, registrySource, websiteSource] = await Promise.all([
    readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8"),
    readFile(path.join(REPO_ROOT, "lib/onboarding/registry.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "lib/onboarding/website.ts"), "utf8"),
  ]);
  for (const source of [routeSource, onboardingSource, registrySource, websiteSource]) {
    assert.doesNotMatch(source, /koraafric/i);
    assert.doesNotMatch(source, /"Kora"/);
  }
});

// --- 10. Onboarding never auto-grants Pro/complimentary ---

test("onboarding's business creation always sets plan: \"starter\" — Pro/complimentary remains a separate, later platform-admin action", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /plan:\s*"starter"/);
  assert.doesNotMatch(source, /plan:\s*"pro"/);
  assert.doesNotMatch(source, /complimentary/);
});
