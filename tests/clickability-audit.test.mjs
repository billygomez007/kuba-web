// Full clickability/destination audit (docs/acceptance/FULL_CLICK_AUDIT.md).
// Uses the TypeScript compiler API (scripts/lib/clickability-scanner.mjs) to
// statically walk every href, href-data-property, router.push/replace call,
// and <button> across app/dashboard, app/admin, app/onboarding, and
// app/components, and asserts three things stay at zero:
//
//   1. An internal href/router-call that doesn't resolve to any real route.
//   2. A placeholder: href="#", href="javascript:void(0)", an empty
//      onClick, a console-only onClick, or an alert-only onClick.
//   3. A <button> with no onClick, no type="submit"/"reset", not disabled,
//      and not inside a <form> (where the browser default is submit) — a
//      button that does nothing when clicked.
//
// "dynamic-unresolved" findings (href values the scanner can't read
// statically — component props, values computed in a function, or hrefs
// returned by an API route) are NOT asserted against here: they were
// manually verified once during the audit (see the doc above) and can't be
// meaningfully re-verified by a fast, dependency-free static test. Real
// server-computed href correctness for those is instead covered by the
// per-route API tests already in this suite.
import { scanDirectories } from "../scripts/lib/clickability-scanner.mjs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const { routes, findings } = scanDirectories(REPO_ROOT, ["app/dashboard", "app/admin", "app/onboarding", "app/components"]);

test("sanity: the scanner discovers a substantial number of real routes and findings (guards against a silent scan failure passing vacuously)", () => {
  assert.ok(routes.length > 50, `expected 50+ discovered routes, got ${routes.length}`);
  assert.ok(findings.length > 100, `expected 100+ clickable findings, got ${findings.length}`);
});

test("REGRESSION: no internal href, href-data property, or router.push/replace call points at a route that doesn't exist", () => {
  const broken = findings.filter((f) => f.classification === "internal" && f.matchesKnownRoute === false);
  const description = broken.map((f) => `${path.relative(REPO_ROOT, f.file)}:${f.line}  ${f.raw}`).join("\n");
  assert.equal(broken.length, 0, `broken internal destinations found:\n${description}`);
});

test("REGRESSION: no placeholder href (href=\"#\", javascript:void) exists anywhere in the audited surface", () => {
  const placeholders = findings.filter((f) => f.kind === "href" && f.classification === "placeholder");
  const description = placeholders.map((f) => `${path.relative(REPO_ROOT, f.file)}:${f.line}`).join("\n");
  assert.equal(placeholders.length, 0, `placeholder hrefs found:\n${description}`);
});

test("REGRESSION: no onClick handler is empty, console-only, or alert-only", () => {
  const deadHandlers = findings.filter((f) => f.kind === "onClick-empty" || f.kind === "onClick-console-only" || f.kind === "onClick-alert-only");
  const description = deadHandlers.map((f) => `${path.relative(REPO_ROOT, f.file)}:${f.line}  [${f.kind}]`).join("\n");
  assert.equal(deadHandlers.length, 0, `dead onClick handlers found:\n${description}`);
});

test("REGRESSION: no <button> is inert (no onClick, not type=submit/reset, not disabled, not inside a <form>)", () => {
  const inertButtons = findings.filter((f) => f.kind === "button-no-handler");
  const description = inertButtons.map((f) => `${path.relative(REPO_ROOT, f.file)}:${f.line}`).join("\n");
  assert.equal(inertButtons.length, 0, `inert buttons found:\n${description}`);
});

test("REGRESSION: Help sidebar link (app/dashboard/layout.tsx) points at a page that actually exists — previously pointed at /help, which had no route at all", async () => {
  const helpFindings = findings.filter((f) => f.file.endsWith("app/dashboard/layout.tsx") && f.raw === "/dashboard/help");
  assert.ok(helpFindings.length > 0, "expected to find the Help link pointing at /dashboard/help in app/dashboard/layout.tsx");
  assert.equal(helpFindings[0].matchesKnownRoute, true);
});

test("REGRESSION: the dashboard home page's Help Center link also points at the real Help page", async () => {
  const helpFindings = findings.filter((f) => f.file.endsWith("app/dashboard/page.tsx") && f.raw === "/dashboard/help");
  assert.ok(helpFindings.length > 0, "expected to find the Help Center link pointing at /dashboard/help in app/dashboard/page.tsx");
});

test("app/dashboard/help/page.tsx exists and is the real Help destination", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/help/page.tsx"), "utf8");
  assert.match(source, /Help/);
  // No invented contact data — only the real sales@superkuba.com address
  // (already used elsewhere in the app, on the Enterprise plan card) and
  // the real /demo Contact Sales form.
  assert.doesNotMatch(source, /support@superkuba\.com|help@superkuba\.com/, "must not invent a support email that doesn't exist anywhere else in the app");
});
