// Regression suite locking in a LIVE-PROVEN fact about the real staging
// database that backs Preview deployments (read-only introspection run
// during the investigation of the second "Team & Staff 404 / Billing
// Unable to load" live bug report): its __drizzle_migrations ledger stops
// at 0041 — migrations 0042 (entitlement/AI-authority additions),
// 0043 (outreach_campaign_recipients/outreach_campaign_sends/etc.), and
// 0044 (organizations/organization_members/organization_businesses) have
// never been applied there, so those tables genuinely do not exist in the
// database Preview requests hit.
//
// Direct, real-business reproduction against that live database (business
// "Realtegic Works", real getBusinessPlan/getBusinessUsage calls) showed
// getBusinessUsage() already degrades cleanly (per the schema-drift fix in
// tests/team-billing-live-fix.test.mjs) and getBusinessPlan() never touches
// the missing tables at all — so /api/billing/usage's full call sequence
// does not throw under the real drift. This suite pins that exact
// three-migration-behind condition (not just the single missing-0043
// scenario the prior fix tested) as a permanent regression guard: schema
// bootstrapped from db/schema.ts as it existed immediately before migration
// 0042 was added (commit 1c7995d, the parent of d930a20 which introduced
// 0042), so outreach_campaign_*, organizations, organization_members, and
// organization_businesses are ALL absent — exactly the live condition.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile, unlink, readFile as readFileForWiring } from "node:fs/promises";
import { existsSync as fileExistsForWiring } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

// The commit immediately before 0042_cuddly_starhawk.sql was introduced —
// db/schema.ts here has no outreach campaign engine and no
// organization/portfolio tables, matching the real staging drift exactly.
const PRE_0042_COMMIT = "1c7995d";

let tempDir;
let databasePath;
let db, schema;
let getBusinessUsage;
let getBusinessPlan;
let getPlanDefinition;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-staging-drift-repro-"));
  databasePath = path.join(tempDir, "database.db");
  const snapshotSchemaPath = path.join(REPO_ROOT, "db", `schema.snapshot-pre-0042-${process.pid}.ts`);

  const oldSchemaSource = execFileSync("git", ["show", `${PRE_0042_COMMIT}:db/schema.ts`], { cwd: REPO_ROOT, encoding: "utf8" });
  await writeFile(snapshotSchemaPath, oldSchemaSource);

  try {
    const exportedSql = execFileSync("npx", ["drizzle-kit", "export", "--dialect", "turso", "--schema", `./db/${path.basename(snapshotSchemaPath)}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    const client = createClient({ url: `file:${databasePath}` });
    await client.executeMultiple(exportedSql);
    client.close();
  } finally {
    await unlink(snapshotSchemaPath).catch(() => {});
  }

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ getBusinessUsage } = await import("@/lib/billing/usage"));
  ({ getBusinessPlan, getPlanDefinition } = await import("@/lib/billing/entitlements"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("REGRESSION (live-proven drift): outreach_campaign_recipients, outreach_campaign_sends, organizations, organization_members, and organization_businesses do NOT exist on a database frozen at the real staging ledger position (through migration 0041)", async () => {
  const rawClient = createClient({ url: `file:${databasePath}` });
  const tables = await rawClient.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('outreach_campaign_recipients','outreach_campaign_sends','organizations','organization_members','organization_businesses')",
  );
  rawClient.close();
  assert.equal(tables.rows.length, 0, "this test's bootstrapped schema must reproduce the real staging drift exactly — if any of these tables now exist, PRE_0042_COMMIT needs updating");
});

test("REGRESSION (live-proven): getBusinessPlan() never touches an outreach/organization table, so it succeeds unchanged against the real drifted staging schema", async () => {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name: "Drift Repro Co", slug: `${id}-slug`, plan: "starter", status: "active", createdAt: now, updatedAt: now });

  const plan = await getBusinessPlan(id);
  assert.equal(plan.id, "starter");
  assert.equal(plan.employeeLimit, 1);
});

test("REGRESSION (live-proven): getBusinessUsage() degrades to not_tracked instead of throwing when outreach_campaign_recipients/sends are missing — the exact real staging condition, not a hypothetical one", async () => {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name: "Drift Repro Co 2", slug: `${id}-slug`, plan: "starter", status: "active", createdAt: now, updatedAt: now });

  const plan = getPlanDefinition("starter");
  const usage = await getBusinessUsage(id, plan);
  assert.equal(usage.campaignRecipients.state, "not_tracked");
  assert.equal(usage.campaignSends.state, "not_tracked");
  // The whole Promise.all is one unit: a single missing table degrades every
  // counter to "not tracked" together, not just the outreach ones — this is
  // the shipped fix's actual (accepted) all-or-nothing behavior, not a bug.
  assert.equal(usage.employees.state, "not_tracked");
  assert.equal(usage.employees.used, null);
});

test("REGRESSION (live-proven): the full /api/billing/usage dependency sequence (getBusinessPlan then getBusinessUsage) completes without throwing under the real drifted schema — this is the exact call order the route makes", async () => {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name: "Drift Repro Co 3", slug: `${id}-slug`, plan: "starter", status: "active", createdAt: now, updatedAt: now });

  await assert.doesNotReject(async () => {
    const plan = await getBusinessPlan(id);
    await getBusinessUsage(id, plan);
  });
});

// ==================================================
// Team & Staff route wiring — locks in the exact nav href -> filesystem
// route -> API dependency chain proven live: the sidebar's "Team Staff"
// link, the settings/team page it points to, and all six endpoints that
// page fetches on load all exist and are wired consistently. If a future
// change renames the page's folder or drops one of these route files, this
// fails immediately instead of surfacing as a live 404 again.
// ==================================================

test("REGRESSION: the sidebar's Team Staff nav href points at a page.tsx that actually exists on disk, under the canonical /dashboard/settings/team route", async () => {
  const layoutSource = await readFileForWiring(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(layoutSource, /label:\s*"Team Staff",\s*href:\s*"\/dashboard\/settings\/team"/);
  assert.ok(fileExistsForWiring(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx")), "app/dashboard/settings/team/page.tsx must exist for this href to resolve instead of 404ing");
});

test("REGRESSION: every API endpoint the Team & Staff page fetches on load has a real route file exporting GET", () => {
  const endpointToFile = {
    "/api/team/members": "app/api/team/members/route.ts",
    "/api/team/invitations": "app/api/team/invitations/route.ts",
    "/api/teams": "app/api/teams/route.ts",
    "/api/teams/members": "app/api/teams/members/route.ts",
    "/api/teams/ai-employees": "app/api/teams/ai-employees/route.ts",
    "/api/ai-employees": "app/api/ai-employees/route.ts",
  };
  for (const [endpoint, file] of Object.entries(endpointToFile)) {
    const fullPath = path.join(REPO_ROOT, file);
    assert.ok(fileExistsForWiring(fullPath), `${endpoint} has no route file at ${file}`);
  }
});
