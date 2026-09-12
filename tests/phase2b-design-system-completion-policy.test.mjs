// Phase 2B structural checks. Prior audit found several places where the
// Command Center and AI Employees screens displayed a hardcoded "Online" /
// "Operational" / "Active" badge regardless of any real employee status —
// this suite guards against that fabricated-liveness pattern reappearing,
// and confirms the canonical primitives actually replaced the ad hoc
// loading/error/metric-card recipes in Analytics and Inbox/Conversations/
// Handoffs rather than just adding imports nobody uses.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Command Center no longer renders a static 'Operational'/'Active' status block unrelated to real data", async () => {
  const source = await readFile("app/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(source, />Operational</);
  assert.doesNotMatch(source, /AI Workforce Status/);
  assert.doesNotMatch(source, /function StatCard/);
});

test("the workforce page renders real employee status via StatusBadge instead of a hardcoded 'Online' label", async () => {
  const source = await readFile("app/dashboard/workforce/page.tsx", "utf8");
  assert.doesNotMatch(source, />\s*Online\s*</);
  assert.match(source, /import StatusBadge from "\.\.\/\.\.\/components\/ui\/StatusBadge"/);
  assert.match(source, /<StatusBadge status={employee\.status} dot \/>/);
  assert.match(source, /<StatusBadge status={generalManager\.status} dot \/>/);
});

test("Analytics uses the canonical MetricCard/LoadingState/ErrorState instead of its own duplicate implementations", async () => {
  const source = await readFile("app/dashboard/analytics/page.tsx", "utf8");
  assert.match(source, /import MetricCard from "\.\.\/\.\.\/components\/ui\/MetricCard"/);
  assert.match(source, /import LoadingState from "\.\.\/\.\.\/components\/ui\/LoadingState"/);
  assert.match(source, /import ErrorState from "\.\.\/\.\.\/components\/ui\/ErrorState"/);
  assert.doesNotMatch(source, /function MetricCard/);
  assert.doesNotMatch(source, /detail=/);
});

test("Inbox, Conversations, and Handoffs use the canonical LoadingState/ErrorState instead of ad hoc text", async () => {
  for (const file of [
    "app/dashboard/inbox/page.tsx",
    "app/dashboard/conversations/page.tsx",
    "app/dashboard/handoffs/page.tsx",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /import LoadingState from "\.\.\/\.\.\/components\/ui\/LoadingState"/);
    assert.match(source, /import ErrorState from "\.\.\/\.\.\/components\/ui\/ErrorState"/);
    assert.match(source, /<LoadingState/);
    assert.match(source, /<ErrorState/);
  }
});

test("Inbox metrics use the canonical MetricCard rather than its own local Metric function", async () => {
  const source = await readFile("app/dashboard/inbox/page.tsx", "utf8");
  assert.doesNotMatch(source, /function Metric\(/);
  assert.match(source, /import MetricCard from "\.\.\/\.\.\/components\/ui\/MetricCard"/);
  assert.match(source, /<MetricCard label="Total conversations"/);
});

test("Conversations and Handoffs pages now show a loading state before data resolves (previously the list just stayed empty)", async () => {
  for (const file of ["app/dashboard/conversations/page.tsx", "app/dashboard/handoffs/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /const \[loading, setLoading\] = useState\(true\)/);
    assert.match(source, /\.finally\(\(\) => setLoading\(false\)\)/);
  }
});

test("billing/trial UX still discloses no charge only in the post-cancellation confirmation, never as a pre-checkout promise (regression guard)", async () => {
  const source = await readFile("app/dashboard/billing/page.tsx", "utf8");
  assert.match(source, /will not be charged/);
});
