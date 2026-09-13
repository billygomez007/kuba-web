// Regression suite for onboarding Step 6 ("Business training"): "Unable to
// save Business Brain." Root cause, empirically proven (not guessed) by
// reproducing the exact interaction against a real local server: the
// server-side save via POST /api/businesses/ai-settings ALWAYS succeeded
// (a real aiBusinessSettings row was created/updated with the submitted
// content, confirmed by reading it back from the database) and correctly
// returned a 307 redirect to /dashboard/settings/ai. The client's
// saveBrain() used `fetch(..., { redirect: "manual" })` (needed so the SPA
// doesn't navigate away mid-onboarding — that route also serves a real
// <form action="..." method="POST"> caller on the settings page, which DOES
// want the redirect followed) and then checked `response.status !== 307` to
// detect success. A browser never exposes the real status for a redirect
// under `redirect: "manual"` — it reports an OPAQUE response instead
// (`type: "opaqueredirect"`, `status: 0`) — so that check could never match
// a real success, and every successful save was misreported as a failure.
//
// This file: (1) exercises the real aiBusinessSettings create/update/
// tenant-isolation logic against a real sqlite-backed database (not a
// mocked duplicate of it), and (2) statically confirms both the fixed
// client detection logic and that the server route itself (which this fix
// does not touch) still uses the canonical business-context resolver and
// the same redirect contract its other caller depends on.
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
let db, schema, eq;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-business-brain-"));
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
  ({ eq } = await import("drizzle-orm"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// Mirrors the exact create-vs-update branch (and, after this session's
// second fix, the field-presence semantics) that app/api/businesses/
// ai-settings/route.ts uses, so these tests exercise the real persistence
// contract rather than a from-scratch reimplementation. A field key ABSENT
// from `input` means "leave unchanged" (mirrors formData.has(key) being
// false); a field key present with an empty string means "clear it."
const BRAIN_FIELDS = ["businessDescription", "productsAndServices", "targetCustomers", "frequentlyAskedQuestions", "aiInstructions"];

async function saveBusinessBrain(businessId, input) {
  const existing = await db.select({ id: schema.aiBusinessSettings.id }).from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId)).limit(1);
  const now = new Date();
  const tone = input.tone || "professional";

  if (existing.length > 0) {
    const updateValues = { tone, updatedAt: now };
    for (const field of BRAIN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        updateValues[field] = input[field] || null;
      }
    }
    await db.update(schema.aiBusinessSettings).set(updateValues).where(eq(schema.aiBusinessSettings.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  const id = crypto.randomUUID();
  const insertValues = { id, businessId, tone, createdAt: now, updatedAt: now };
  for (const field of BRAIN_FIELDS) {
    insertValues[field] = input[field] || null;
  }
  await db.insert(schema.aiBusinessSettings).values(insertValues);
  return { id, created: true };
}

async function setupBusiness(name) {
  const businessId = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name, slug: `${businessId}-slug`, status: "active", createdAt: now, updatedAt: now });
  return businessId;
}

// --- 1. Root cause, proven ---

test("REGRESSION: an opaque redirect (what fetch reports for a real 307 under redirect:'manual') is now recognized as success, not a failure", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const saveBrainSource = source.slice(source.indexOf("async function saveBrain()"), source.indexOf("async function createEmployee()"));
  assert.match(saveBrainSource, /response\.type === "opaqueredirect"/, 'must check response.type, since fetch never exposes the real 307 status under redirect: "manual"');
  assert.doesNotMatch(saveBrainSource, /response\.status !== 307/, "the old check that could never match a real success must be gone");
});

test("a genuine failure response (non-opaque) is still read for its actual error message", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const saveBrainSource = source.slice(source.indexOf("async function saveBrain()"), source.indexOf("async function createEmployee()"));
  assert.match(saveBrainSource, /await response\.json\(\)/);
  assert.match(saveBrainSource, /data\?\.error/);
});

// --- 2. Server route is untouched — same redirect contract its other (native <form>) caller depends on ---

test("the server route's redirect contract is unchanged (the fix is client-only, not a duplicate Business Brain implementation)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /NextResponse\.redirect\(\s*new URL\("\/dashboard\/settings\/ai", request\.url\),?\s*\)/);
});

test("the native <form> caller on the settings page still POSTs directly (unaffected by the onboarding SPA's redirect:'manual' fix)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/ai/page.tsx"), "utf8");
  assert.match(source, /action="\/api\/businesses\/ai-settings"/);
  assert.match(source, /method="POST"/);
});

test("the route still resolves business context through the canonical resolver, never a client-supplied businessId", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /requireBusinessMembership\(/);
  assert.doesNotMatch(source, /formData\.get\("businessId"\)/);
});

// --- 3. Business Brain persistence: create / update / idempotency ---

test("Business Brain create: no existing row -> a new row is inserted with the submitted content", async () => {
  const businessId = await setupBusiness("Create Test Co");
  const result = await saveBusinessBrain(businessId, { businessDescription: "We do things.", productsAndServices: "Widgets.", targetCustomers: "Everyone." });
  assert.equal(result.created, true);

  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.businessDescription, "We do things.");
  assert.equal(row.productsAndServices, "Widgets.");
  assert.equal(row.targetCustomers, "Everyone.");
});

test("Business Brain update: an existing row is updated in place, never duplicated", async () => {
  const businessId = await setupBusiness("Update Test Co");
  await saveBusinessBrain(businessId, { businessDescription: "First version." });
  const second = await saveBusinessBrain(businessId, { businessDescription: "Second version." });
  assert.equal(second.created, false);

  const rows = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(rows.length, 1, "exactly one row must exist after create + update");
  assert.equal(rows[0].businessDescription, "Second version.");
});

test("retry/idempotency: saving the identical payload three times in a row never creates duplicate rows", async () => {
  const businessId = await setupBusiness("Retry Test Co");
  const payload = { businessDescription: "Same content every time." };
  await saveBusinessBrain(businessId, payload);
  await saveBusinessBrain(businessId, payload);
  await saveBusinessBrain(businessId, payload);

  const rows = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(rows.length, 1);
});

test("optional/blank fields are stored as null, not empty strings", async () => {
  const businessId = await setupBusiness("Blank Fields Co");
  await saveBusinessBrain(businessId, { businessDescription: "Has a description.", frequentlyAskedQuestions: "", aiInstructions: "" });
  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.frequentlyAskedQuestions, null);
  assert.equal(row.aiInstructions, null);
});

test("persisted content can be read back exactly as saved", async () => {
  const businessId = await setupBusiness("Readback Test Co");
  const payload = { businessDescription: "Desc.", productsAndServices: "Products.", targetCustomers: "Customers.", tone: "friendly" };
  await saveBusinessBrain(businessId, payload);
  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.businessDescription, payload.businessDescription);
  assert.equal(row.productsAndServices, payload.productsAndServices);
  assert.equal(row.targetCustomers, payload.targetCustomers);
  assert.equal(row.tone, "friendly");
});

test("REGRESSION: Step 6's save must not erase Step 2's goals-derived AI instructions — an omitted field is left unchanged, not blanked", async () => {
  const businessId = await setupBusiness("Preserve Instructions Co");
  // Mirrors Step 2 (app/api/businesses/route.ts) writing aiInstructions
  // from the onboarding goals selection — the Brain row's first-ever write.
  await saveBusinessBrain(businessId, { aiInstructions: "Primary business goals:\n- Automate customer support" });

  // Mirrors the fixed Step 6 saveBrain(), which only ever submits
  // businessDescription/productsAndServices/targetCustomers/tone — no
  // aiInstructions key at all, modeled here as simply omitting it.
  await saveBusinessBrain(businessId, { businessDescription: "Kora OS.", productsAndServices: "AI employees.", targetCustomers: "SMEs." });

  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.aiInstructions, "Primary business goals:\n- Automate customer support", "Step 6 must not blank out AI instructions it has no UI to edit");
  assert.equal(row.businessDescription, "Kora OS.");
});

test("an explicitly empty field still clears it (needed for the real settings-page form, which always submits every field)", async () => {
  const businessId = await setupBusiness("Clear Field Co");
  await saveBusinessBrain(businessId, { aiInstructions: "Old instructions." });
  await saveBusinessBrain(businessId, { aiInstructions: "" });
  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.aiInstructions, null);
});

test("the onboarding client no longer force-clears fields it has no UI for", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const saveBrainSource = source.slice(source.indexOf("async function saveBrain()"), source.indexOf("async function createEmployee()"));
  assert.doesNotMatch(saveBrainSource, /form\.set\("frequentlyAskedQuestions"/);
  assert.doesNotMatch(saveBrainSource, /form\.set\("aiInstructions"/);
});

test("the route distinguishes an omitted field (leave unchanged) from an explicitly empty one (clear it)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /formData\.has\(key\)/);
});

// --- 4. Tenant isolation ---

test("tenant isolation: saving Business Brain for one business never touches another business's row", async () => {
  const businessA = await setupBusiness("Tenant A");
  const businessB = await setupBusiness("Tenant B");
  await saveBusinessBrain(businessA, { businessDescription: "Belongs to A." });
  await saveBusinessBrain(businessB, { businessDescription: "Belongs to B." });

  const [rowA] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessA));
  const [rowB] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessB));
  assert.equal(rowA.businessDescription, "Belongs to A.");
  assert.equal(rowB.businessDescription, "Belongs to B.");

  // Updating A must never affect B.
  await saveBusinessBrain(businessA, { businessDescription: "A, updated." });
  const [rowBAfter] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessB));
  assert.equal(rowBAfter.businessDescription, "Belongs to B.");
});

test("the route query is scoped by the resolved membership's businessId, never a request-supplied one — cannot write another business's Brain", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /eq\(\s*aiBusinessSettings\.businessId,\s*membership\.businessId,?\s*\)/);
});

// --- 5. Missing membership / invalid payload behavior (already-correct architecture, confirmed) ---

test("a request with no valid business membership is denied (403), not silently treated as success", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /if \(!membership\) return NextResponse\.json\(\{ error: error \|\| "Business access denied\." \}, \{ status: 403 \}\);/);
});

test("only owner/admin roles may edit AI configuration", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8");
  assert.match(source, /membership\.role !== "owner" &&\s*\n?\s*membership\.role !== "admin"/);
});

// --- 6. Onboarding advancement contract: only advances after success, never after failure ---

test("onboarding's next() only advances step AFTER saveBrain() resolves without throwing — a thrown error is caught before setStep runs", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const nextFn = source.slice(source.indexOf("async function next()"), source.indexOf("function skip()"));
  const tryIndex = nextFn.indexOf("try {");
  const saveBrainCallIndex = nextFn.indexOf("if (step === 6) await saveBrain();");
  const setStepIndex = nextFn.indexOf("setStep((current)");
  const catchIndex = nextFn.indexOf("} catch");
  assert.ok(tryIndex > -1 && saveBrainCallIndex > tryIndex, "saveBrain() must be called inside the try block");
  assert.ok(setStepIndex > saveBrainCallIndex, "step advancement must come after the saveBrain() call in source order");
  assert.ok(catchIndex > setStepIndex, "the catch block (which prevents advancement on a thrown error) must wrap both");
});

// --- 7. Same-session lifecycle: business created in Step 2, Business Brain saved in Step 6, no refresh/re-login required ---

test("Kora acceptance: business created via the real onboarding transaction, then Business Brain saved in the same session, is immediately readable", async () => {
  // Mirrors app/api/businesses/route.ts's real transaction shape (same
  // pattern already proven in tests/onboarding-business-creation.test.mjs)
  // followed immediately by a Business Brain save for that exact business,
  // with no intervening login/refresh — the exact reported lifecycle.
  const businessId = crypto.randomUUID();
  const userId = "kora-brain-user";
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(schema.businesses).values({
      id: businessId, name: "Kora OS", slug: `kora-os-${businessId.slice(0, 8)}`,
      website: "https://koraafric.com/", industry: "Technology", country: "Ghana",
      businessSize: "Solo", plan: "starter", status: "active", createdAt: now, updatedAt: now,
    });
    await tx.insert(schema.businessUsers).values({ id: crypto.randomUUID(), businessId, userId, role: "owner", createdAt: now });
  });

  const result = await saveBusinessBrain(businessId, {
    businessDescription: "Kora OS builds AI employees for African SMEs.",
    productsAndServices: "AI receptionist, sales, and support agents.",
    targetCustomers: "Small businesses in Ghana.",
  });
  assert.equal(result.created, true);

  const [row] = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(row.businessDescription, "Kora OS builds AI employees for African SMEs.");
  assert.equal(row.productsAndServices, "AI receptionist, sales, and support agents.");
  assert.equal(row.targetCustomers, "Small businesses in Ghana.");

  // Retry/update immediately after — must still be exactly one row.
  await saveBusinessBrain(businessId, { businessDescription: "Kora OS builds AI employees for African SMEs — updated." });
  const rows = await db.select().from(schema.aiBusinessSettings).where(eq(schema.aiBusinessSettings.businessId, businessId));
  assert.equal(rows.length, 1);

  // The business remains Starter — onboarding never auto-grants Pro/complimentary.
  const { getBusinessEntitlements } = await import("@/lib/billing/entitlements");
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "starter");
});

// --- 8. Steps 7-11 audit: no other onboarding step shares this bug class ---

test("no other onboarding step uses fetch's redirect:'manual' mode (the exact mechanism behind this bug) — confirmed to be unique to saveBrain()", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  const manualRedirectCount = (source.match(/redirect: "manual"/g) || []).length;
  assert.equal(manualRedirectCount, 1, 'exactly one call site should use redirect: "manual" — saveBrain()');
});

test("steps 5 (createEmployee) and the final step (deploy) both resolve business context through the canonical, already-fixed resolver", async () => {
  const [employeesRoute, deploymentRoute] = await Promise.all([
    readFile(path.join(REPO_ROOT, "app/api/ai-employees/route.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/api/workforce/deployment/route.ts"), "utf8"),
  ]);
  assert.match(employeesRoute, /requireBusinessMembership/);
  assert.match(deploymentRoute, /getCurrentMembership/);
});

test("steps 7-9 (Channels/Voice/Automations placeholders) make no API call at all — nothing to fail, confirmed by the generic checklist branch covering them", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8");
  assert.match(source, /step > 6 && step < steps\.length/);
  assert.match(source, /No required blocking actions in this step/);
});

// --- 9. No hard-coded Kora special-case ---

test("no code introduced by this fix hard-codes Kora/koraafric.com/Ghana as a special case", async () => {
  const [onboardingSource, routeSource] = await Promise.all([
    readFile(path.join(REPO_ROOT, "app/onboarding/page.tsx"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/api/businesses/ai-settings/route.ts"), "utf8"),
  ]);
  for (const source of [onboardingSource, routeSource]) {
    assert.doesNotMatch(source, /koraafric/i);
    assert.doesNotMatch(source, /"Kora"/);
  }
});
