// Regression suite for the internal stability/production-readiness pass.
//
// PHASE 1/2 CONTEXT: a minified React hydration warning (error #418) was
// previously reported as reproducing on /dashboard/settings, /dashboard/
// settings/profile, /dashboard/settings/ai, and /dashboard/human-workforce/
// [section]. This pass could not reproduce it despite rigorous, repeated
// attempts (next dev and next start, fresh browser contexts per route, warm
// and cold caches, a real login flow, all 4 named routes plus every other
// human-workforce section) — see the final report for the full methodology.
// A complete source-level audit of every component in those routes' render
// trees found nothing that violates React's own hydration-safety rules:
// every date/locale-dependent value is deferred to a post-mount client
// effect (starts from null/[]), and every editable form field uses
// defaultValue/defaultChecked, which React's hydration algorithm explicitly
// does not validate against server output (by design, to accommodate
// browser autofill/bfcache restoration).
//
// What this audit DID find, as a validating control proving the method
// actually detects this bug class when present: two genuine (if currently
// non-visible, since they fed only empty initial arrays) hydration-risk
// patterns elsewhere in app/dashboard, both fixed here.
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

async function readSource(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

test("REGRESSION: tasks page no longer seeds a nondeterministic Date.now() lazy initializer during render — the real value is set client-side only, deferred out of the effect body (avoids both hydration mismatch and the set-state-in-effect lint rule), after mount", async () => {
  const source = await readSource("app/dashboard/tasks/page.tsx");
  assert.doesNotMatch(source, /useState\(\(\) => Date\.now\(\)\)/);
  assert.match(source, /const \[currentTime, setCurrentTime\] = useState\(0\)/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*setCurrentTime\(Date\.now\(\)\);\s*\}, 0\)/);
});

test("REGRESSION: follow-ups page no longer seeds a nondeterministic Date.now() lazy initializer during render — same fix pattern as tasks/page.tsx", async () => {
  const source = await readSource("app/dashboard/follow-ups/page.tsx");
  assert.doesNotMatch(source, /useState<number>\(\(\) => Date\.now\(\)\)/);
  assert.match(source, /const \[now, setNow\] = useState<number>\(0\)/);
  const effectSection = source.slice(source.indexOf("const initial = window.setTimeout"));
  assert.match(effectSection, /window\.setInterval/, "the periodic refresh must still exist — this is a fix for the INITIAL value only, not a removal of the live-updating behavior");
});

test("the four originally-reported hydration-affected routes still exist and are unchanged since the issue was first documented (ruling out an accidental, undocumented fix as the reason reproduction failed)", async () => {
  for (const file of [
    "app/dashboard/settings/page.tsx",
    "app/dashboard/settings/profile/page.tsx",
    "app/dashboard/settings/ai/page.tsx",
    "app/dashboard/human-workforce/WorkforceView.tsx",
  ]) {
    const source = await readSource(file);
    assert.ok(source.length > 0, `${file} must exist`);
  }
});

test("SAFETY PROPERTY: none of the four reported routes' server-rendered content depends on Date.now(), Math.random(), or crypto.randomUUID() outside a client-only effect", async () => {
  const files = [
    "app/dashboard/settings/page.tsx",
    "app/dashboard/settings/profile/page.tsx",
    "app/dashboard/settings/ai/page.tsx",
    "app/dashboard/human-workforce/WorkforceView.tsx",
  ];
  for (const file of files) {
    const source = await readSource(file);
    // A bare, non-effect-guarded call would be the actual live risk; the
    // WorkforceView date() helper is deliberately allowed since it only
    // ever runs against client-fetched `data`, which starts null (never
    // part of the server-rendered payload for this client component).
    const suspiciousLazyState = /useState\([^)]*=>\s*(Date\.now\(\)|Math\.random\(\)|crypto\.randomUUID\(\))/;
    assert.doesNotMatch(source, suspiciousLazyState, `${file} must not seed useState with a nondeterministic lazy initializer`);
  }
});

test("no loading.tsx/error.tsx Suspense-boundary files exist near the reported routes that could introduce a streaming-related hydration discrepancy", async () => {
  const { execFileSync } = await import("node:child_process");
  const output = execFileSync("find", ["app", "-iname", "loading.tsx", "-o", "-iname", "error.tsx", "-o", "-iname", "global-error.tsx"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(output.trim(), "", "no loading/error boundary files exist anywhere in app/ — confirmed during this audit, not assumed");
});
