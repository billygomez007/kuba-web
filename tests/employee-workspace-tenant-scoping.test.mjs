// Regression for the reported "Configure/Open employee -> 404" defect.
//
// Root cause (confirmed by reading the code, not guessed): both
// app/dashboard/employees/[id]/page.tsx and .../settings/page.tsx resolved
// the caller's business with a raw, non-cookie-aware query —
// `db.select(...).from(businessUsers).where(eq(businessUsers.userId, ...)).limit(1)`
// — which always takes the user's FIRST membership row, ignoring the
// superkuba_business_id cookie entirely. Any user belonging to more than
// one business who has switched away from their first one would have every
// employee lookup here resolved against the wrong business, find no row,
// and hit notFound(). Every other tenant-scoped route in the app instead
// uses the cookie-aware getCurrentMembership()/requireBusinessMembership()
// (lib/auth/tenant.ts). This test statically proves both pages now do too
// — next/headers-backed server components can't be invoked directly
// outside a real request, matching this repo's established pattern for
// this class of route (real logic + static assertions proving the route
// calls it in order).
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const FILES = [
  "app/dashboard/employees/[id]/page.tsx",
  "app/dashboard/employees/[id]/settings/page.tsx",
];

for (const file of FILES) {
  test(`REGRESSION: ${file} resolves the caller's business via the cookie-aware getCurrentMembership(), not a raw first-row query`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /from ["']@\/lib\/auth\/tenant["']/);
    assert.match(source, /getCurrentMembership\(\)/);
    assert.doesNotMatch(
      source,
      /\.from\(businessUsers\)\s*\.where\(\s*eq\(\s*businessUsers\.userId/s,
      `${file} must never resolve the CURRENT user's business with a raw, cookie-unaware businessUsers query again`,
    );
  });
}

test("REGRESSION: the employee workspace page still distinguishes unauthenticated (-> /login) from no-membership (-> /onboarding)", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/dashboard/employees/[id]/page.tsx"),
    "utf8",
  );
  assert.match(source, /redirect\("\/login"\)/);
  assert.match(source, /redirect\("\/onboarding"\)/);
});

test("REGRESSION: the settings page still enforces owner/admin before allowing edits", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "app/dashboard/employees/[id]/settings/page.tsx"),
    "utf8",
  );
  assert.match(source, /business\.role === "owner"/);
  assert.match(source, /business\.role === "admin"/);
});
