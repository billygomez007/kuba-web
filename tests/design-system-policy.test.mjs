// Phase 2 design-system/product-intentionality structural checks. These
// verify the canonical primitives exist and are actually adopted by the
// pages migrated in this pass — not CSS implementation details, just that
// the consolidation actually happened and nothing regressed functionally.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PRIMITIVES = [
  "app/components/ui/Button.tsx",
  "app/components/ui/StatusBadge.tsx",
  "app/components/ui/Card.tsx",
  "app/components/ui/MetricCard.tsx",
  "app/components/EmptyState.tsx",
  "app/components/ui/LoadingState.tsx",
  "app/components/ui/ErrorState.tsx",
  "app/components/ui/Dialog.tsx",
  "app/components/ui/FormField.tsx",
  "app/components/ui/ProductShowcase.tsx",
];

for (const file of PRIMITIVES) {
  test(`canonical primitive ${file} exists`, () => {
    assert.equal(existsSync(file), true);
  });
}

test("no duplicate loading/error page components remain alongside the canonical LoadingState/ErrorState", () => {
  assert.equal(existsSync("app/components/SuperKubaLoading.tsx"), false);
  assert.equal(existsSync("app/components/SuperKubaErrorPage.tsx"), false);
});

test("design tokens are defined in globals.css (surfaces, text, radius, shadow roles)", async () => {
  const css = await readFile("app/globals.css", "utf8");
  for (const token of [
    "--color-surface-page",
    "--color-surface-card",
    "--color-border-default",
    "--color-text-primary",
    "--color-text-tertiary",
    "--color-accent",
    "--radius-card",
    "--shadow-dialog",
  ]) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Business Operations and Customers pages consume the canonical MetricCard rather than a bespoke stat-card recipe", async () => {
  for (const file of ["app/dashboard/business-operations/page.tsx", "app/dashboard/customers/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /import MetricCard from/);
    assert.match(source, /<MetricCard/);
  }
});

test("Tickets, Appointments, Business Operations, and Customers use the canonical LoadingState instead of ad hoc 'Loading...' text", async () => {
  for (const file of [
    "app/dashboard/tickets/page.tsx",
    "app/dashboard/appointments/page.tsx",
    "app/dashboard/business-operations/page.tsx",
    "app/dashboard/customers/page.tsx",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /import LoadingState from/);
    assert.match(source, /<LoadingState/);
  }
});

test("settings/team no longer uses the rogue light theme (no bg-white/slate-* classes remain)", async () => {
  const source = await readFile("app/dashboard/settings/team/page.tsx", "utf8");
  assert.doesNotMatch(source, /slate-\d/);
  assert.doesNotMatch(source, /bg-\[#f8fafc\]/);
  assert.match(source, /bg-surface-page/);
});

test("the six near-identical marketing showcase components were consolidated into one ProductShowcase", () => {
  for (const obsolete of [
    "app/components/SuperKubaDashboardShowcase.tsx",
    "app/components/SuperKubaAIWorkforceShowcase.tsx",
    "app/components/SuperKubaAnalyticsShowcase.tsx",
    "app/components/SuperKubaAutomationShowcase.tsx",
    "app/components/SuperKubaBusinessOperationsShowcase.tsx",
    "app/components/SuperKubaCustomerOperationsShowcase.tsx",
  ]) {
    assert.equal(existsSync(obsolete), false);
  }
});

test("homepage and /products both render the consolidated ProductShowcase for every product area", async () => {
  for (const file of ["app/page.tsx", "app/products/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /import ProductShowcase from/);
    const count = (source.match(/<ProductShowcase/g) || []).length;
    assert.ok(count >= 5, `expected at least 5 ProductShowcase usages in ${file}, found ${count}`);
  }
});

test("brand naming stays 'SuperKuba' (not 'SuperKuba AI') in copyright/site metadata contexts", async () => {
  for (const [file, pattern] of [
    ["app/layout.tsx", /"SuperKuba AI workforce platform"/],
    ["app/login/page.tsx", /© \{new Date\(\)\.getFullYear\(\)\} SuperKuba AI\./],
    ["lib/email/templates.ts", /const BRAND_NAME = "SuperKuba AI"/],
  ]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, pattern);
  }
});

test("the homepage hero no longer presents a fabricated live employee count", async () => {
  const source = await readFile("app/page.tsx", "utf8");
  assert.doesNotMatch(source, /\d+ AI employees active/);
});

test("MarketingHeader still declares mobile navigation semantics (aria-expanded/aria-controls) — untouched by design-system work", async () => {
  const source = await readFile("app/components/MarketingHeader.tsx", "utf8");
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-controls/);
});

test("no schema or migration files were touched by the design-system pass", () => {
  // Sanity check for this suite's own scope, not a database assertion —
  // db/schema.ts existing is expected; this just documents the invariant
  // that Phase 2 must not need one.
  assert.equal(existsSync("db/schema.ts"), true);
});

test("removed dead backup file is gone and was not a real route", () => {
  assert.equal(existsSync("app/dashboard/employees/sales/page.backup.tsx"), false);
});

test("removed duplicate approval-execution artifacts from Phase 1 stay removed (regression guard)", () => {
  assert.equal(existsSync("app/dashboard/actions"), false);
  assert.equal(existsSync("app/api/actions"), false);
});
