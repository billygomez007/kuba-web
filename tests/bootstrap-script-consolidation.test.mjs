// Two competing platform-admin bootstrap scripts existed:
// scripts/bootstrap-super-admin.mjs (older, Aug 24 foundation commit) and
// scripts/bootstrap-platform-admin.mjs (newer, added with the whole
// organization/portfolio layer — see tests/multi-business-portfolio.test.mjs
// for its own extensive coverage: fail-closed if any admin exists, no HTTP
// route, never fabricates a user/password/session).
//
// They were NOT equivalent: the older script had no guard against
// promoting a SECOND admin outside the audited flow, wrote no audit_logs
// entry, and stored `updated_at` as an ISO string via raw SQL into a
// column the rest of the app treats as epoch-seconds (every other write
// path uses drizzle's own Date handling for that column). The newer
// script's own docstring already declares itself canonical.
//
// Fix: scripts/bootstrap-platform-admin.mjs is the canonical mechanism.
// scripts/bootstrap-super-admin.mjs is now a thin deprecated shim that
// delegates to it, so `npm run bootstrap:super-admin` keeps working
// without a second, unguarded code path.
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("the older bootstrap-super-admin.mjs no longer contains its own independent promotion logic — it delegates to the canonical script", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/bootstrap-super-admin.mjs"), "utf8");
  assert.match(source, /deprecated/i);
  assert.match(source, /bootstrap-platform-admin\.mjs/);
  assert.doesNotMatch(source, /UPDATE users SET platform_role/, "must not still write platform_role directly — that would be the old unguarded code path still live");
});

test("npm run bootstrap:super-admin still points at the same script (backward-compatible invocation)", async () => {
  const packageJson = JSON.parse(await readFile(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["bootstrap:super-admin"], "node scripts/bootstrap-super-admin.mjs");
});

test("the deprecated shim still accepts its original --email= argument form (backward-compatible CLI usage)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/bootstrap-super-admin.mjs"), "utf8");
  assert.match(source, /--email=/);
});

test("the canonical bootstrap-platform-admin.mjs is unmodified by the consolidation and still refuses to run twice (fail-closed)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/bootstrap-platform-admin.mjs"), "utf8");
  assert.match(source, /Refusing to run: an active platform admin already exists/);
});
