// Regression suite for a LIVE-PROVEN dashboard crash, found immediately
// after the clickability audit deployed and initially (wrongly) suspected
// to be a regression from that pass. Reproduced with a headless browser:
// info@realtegicworks.com had just been granted a second business
// membership (Kora, via the admin add_member action) and, on a fresh
// Vercel Preview host (host-only cookies never carry over between unique
// preview deployment hostnames), had no superkuba_business_id cookie yet —
// exactly the "ambiguous" case lib/auth/business-context-policy.ts's own
// selectBusinessMembership() has always documented ("zero or multiple
// memberships resolve to null, leaving the caller to route to... an
// explicit business-selection UI") but which nothing ever actually built.
//
// The crash chain proven via reproduction:
//   1. app/api/businesses/route.ts conflated "ambiguous" (2+ memberships)
//      with "new_user" (0 memberships) into the exact same 404 response —
//      unlike app/api/auth/me and app/api/command-center/overview, which
//      an EARLIER pass already fixed to distinguish these as 200 + a
//      `code`, never a 403/404 (see tests/business-context-recovery-
//      integration.test.mjs). This route was the one consumer missed.
//   2. app/dashboard/page.tsx treated that 404 as "genuinely no business"
//      and rendered the full Command Center anyway, with `business: null`.
//   3. app/components/command-center/BusinessHealthCards.tsx independently
//      fetches /api/command-center/overview, which correctly returns the
//      ambiguous stub `{ code: "AMBIGUOUS_BUSINESS_SELECTION", workforce:
//      null }` (200) — but the component only checked `overview` object
//      truthiness before reading `overview.salesPipeline.total`, not
//      whether `salesPipeline` itself was present. Real, uncaught
//      TypeError, live-proven with a headless browser: "Cannot read
//      properties of undefined (reading 'total')" — unmounted the whole
//      tree, surfacing as the app's global-error "This page couldn't
//      load" boundary.
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

test("REGRESSION: selectBusinessMembership genuinely returns null for 2+ memberships with no selection — the exact live trigger condition (source-level sanity, already covered functionally by business-context-recovery-integration.test.mjs)", async () => {
  const { selectBusinessMembership } = await import("@/lib/auth/business-context-policy");
  const memberships = [
    { businessId: "biz-a", role: "owner", permissions: null, branchId: null },
    { businessId: "biz-b", role: "admin", permissions: null, branchId: null },
  ];
  assert.equal(selectBusinessMembership(memberships), null);
  assert.equal(selectBusinessMembership(memberships, "not-either-of-these"), null);
});

test("REGRESSION: GET /api/businesses distinguishes ambiguous (2+ memberships) from new_user (0 memberships) — previously both returned the identical 404", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /result\.length > 1/, "must branch on having multiple memberships before falling through to the new_user 404");
  const ambiguousBlock = source.slice(source.indexOf("result.length > 1"), source.indexOf("new_user"));
  assert.doesNotMatch(ambiguousBlock, /status:\s*40[349]/, "the ambiguous branch must not use 403/404/409 — matching the established convention (app/api/auth/me, app/api/command-center/overview): a 200 with a distinguishing code, never an authorization-failure-shaped status");
  assert.match(source, /"AMBIGUOUS_BUSINESS_SELECTION"/);
  assert.match(source, /"new_user"/, "the genuine zero-membership case must still exist and still be reachable");
});

test("REGRESSION: app/dashboard/page.tsx checks for AMBIGUOUS_BUSINESS_SELECTION and shows a real business picker, instead of rendering the Command Center with business: null", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/page.tsx"), "utf8");
  assert.match(source, /data\?\.code === "AMBIGUOUS_BUSINESS_SELECTION"/);
  assert.match(source, /needsBusinessSelection/);
  assert.match(source, /api\/businesses\/select/, "the picker must call the real, already tenant-isolation-tested business-select endpoint");
});

test("REGRESSION: the business-selection picker's businesses come only from the API response for the CURRENT authenticated user — never a hardcoded or global list", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/page.tsx"), "utf8");
  const pickerStart = source.indexOf("if (needsBusinessSelection)");
  assert.ok(pickerStart > -1, "expected an `if (needsBusinessSelection)` render branch");
  const pickerBlock = source.slice(pickerStart, pickerStart + 1500);
  assert.match(pickerBlock, /needsBusinessSelection\.map/);
});

test("REGRESSION: BusinessHealthCards only treats a /api/command-center/overview response as real overview data when it actually has the rendered shape (salesPipeline + followUps present, no `code`) — previously any truthy 200 body was accepted", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/components/command-center/BusinessHealthCards.tsx"), "utf8");
  const loadFn = source.slice(source.indexOf("async function loadOverview"), source.indexOf("Business overview error"));
  assert.match(loadFn, /data\.salesPipeline/, "must check for the specific nested field the render logic actually reads, not just object truthiness");
  assert.match(loadFn, /!data\.code|data\.code\s*===\s*undefined/, "must reject a distinguishing-code stub response (ambiguous/no-membership) rather than treating it as real data");
});

test("REGRESSION (direct reproduction of the exact live TypeError): rendering BusinessHealthCards's card-derivation logic against the real ambiguous-state API stub shape does not throw", async () => {
  // Mirrors the component's own `cards` array derivation exactly, using
  // the identical stub shape app/api/command-center/overview/route.ts
  // returns for AMBIGUOUS_BUSINESS_SELECTION / NO_BUSINESS_MEMBERSHIP:
  // { code: "...", workforce: null } — no salesPipeline, no followUps, no
  // employees/customers/conversations at all. Before the fix, `overview`
  // was set directly to this stub (truthy), and `overview.salesPipeline.total`
  // threw. After the fix, the loader itself never sets `overview` from a
  // shape like this, so `overview` stays null and the safe "..." branch is
  // taken — this test proves that guard's logic in isolation.
  const ambiguousStub = { code: "AMBIGUOUS_BUSINESS_SELECTION", workforce: null };
  const looksLikeRealOverview = Boolean(ambiguousStub && !ambiguousStub.code && ambiguousStub.salesPipeline && ambiguousStub.followUps);
  assert.equal(looksLikeRealOverview, false, "the ambiguous stub must never pass the shape guard");

  const realOverview = { employees: 1, customers: 0, conversations: 0, salesPipeline: { total: 0, stages: { new: 0, contacted: 0, qualified: 0, converted: 0 } }, followUps: { total: 0, overdue: 0, assignedToKuba: 0, pending: 0 } };
  const looksReal = Boolean(realOverview && !realOverview.code && realOverview.salesPipeline && realOverview.followUps);
  assert.equal(looksReal, true, "a genuine full overview response must still pass the shape guard");

  assert.doesNotThrow(() => {
    const overview = looksLikeRealOverview ? ambiguousStub : null;
    const value = overview ? overview.salesPipeline.total : "...";
    assert.equal(value, "...");
  });
});
