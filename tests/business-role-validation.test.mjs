// REGRESSION: isBusinessRole() (lib/auth/permission-definitions.ts) is the
// gate for every role string accepted by the Team & Staff invitation flow
// (app/api/team/invitations/route.ts, app/api/team/invitations/accept/
// route.ts), member add/edit (app/api/team/members/route.ts), and the
// platform-admin cross-business add_member action
// (app/api/admin/businesses/[id]/route.ts) — discovered while wiring up
// the admin UI's own "add member" control for exactly that last action.
//
// Its accepted set (owner, manager, sales, receptionist, accountant,
// custom) was missing two roles the rest of the app actively offers and
// uses: "admin" and "member" — both appear in the Team & Staff page's own
// role picker (app/dashboard/settings/team/page.tsx's `roles` array:
// admin, manager, sales, accountant, receptionist, member) and in
// ROLE_PERMISSIONS (which has always had an "admin" entry). A real invite,
// member-add, or admin cross-business grant with role="admin" or
// role="member" was rejected with "Invalid business role"/"Invalid role"
// even though the UI itself offered exactly that choice.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

test("REGRESSION: isBusinessRole accepts every role the Team & Staff page's own role picker offers", async () => {
  const { isBusinessRole } = await import("@/lib/auth/permission-definitions");
  const pageSource = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx"), "utf8");
  const rolesArrayMatch = pageSource.match(/const roles = \[([\s\S]*?)\];/);
  assert.ok(rolesArrayMatch, "could not find the Team & Staff page's `roles` array — this test needs updating if it moved/was renamed");
  const offeredRoles = [...rolesArrayMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(offeredRoles.length >= 5, "sanity check: expected several roles in the picker");
  for (const role of offeredRoles) {
    assert.equal(isBusinessRole(role), true, `Team & Staff offers "${role}" as an assignable role, but isBusinessRole() rejects it`);
  }
});

test("REGRESSION: isBusinessRole specifically accepts 'admin' and 'member' (the two roles it was missing)", async () => {
  const { isBusinessRole } = await import("@/lib/auth/permission-definitions");
  assert.equal(isBusinessRole("admin"), true);
  assert.equal(isBusinessRole("member"), true);
});

test("isBusinessRole still rejects a genuinely invalid role string (the fix is additive, not a wildcard)", async () => {
  const { isBusinessRole } = await import("@/lib/auth/permission-definitions");
  assert.equal(isBusinessRole("superuser"), false);
  assert.equal(isBusinessRole(""), false);
  assert.equal(isBusinessRole("Admin"), false, "case-sensitive — callers already lowercase before calling this");
});

test("the admin business detail page now exposes an add_member control (was previously only reachable via direct API call, with no browser path)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/businesses/[id]/page.tsx"), "utf8");
  assert.match(source, /action:\s*"add_member"/);
  assert.match(source, /Add member/);
});
