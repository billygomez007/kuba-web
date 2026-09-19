// Real implementation-path tests for Marketing 6A-4B Campaign Operations.
// Uses a disposable local SQLite database only — never staging/production.
// Authenticated Next.js route wiring is verified statically because the
// handlers depend on next/headers-backed membership/session resolution.

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db;
let schema;
let getMarketingExecutiveReport;

test.before(async () => {
  tempDir = await mkdtemp(
    path.join(os.tmpdir(), "kuba-marketing-analytics-"),
  );

  const databasePath = path.join(tempDir, "database.db");

  execFileSync(
    "node",
    [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`,
        CLEAN_BOOTSTRAP_KEEP: "1",
      },
      stdio: "pipe",
    },
  );

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");

  ({ getMarketingExecutiveReport } = await import(
    "@/lib/marketing/executive-reporting"
  ));
});

test.after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

const NOW = new Date("2026-09-17T12:00:00.000Z");

async function clearMarketingAnalyticsData() {
  await db.delete(schema.marketingMetricSnapshots);
  await db.delete(schema.marketingAttributions);
  await db.delete(schema.marketingPublishJobs);
  await db.delete(schema.marketingSocialAccounts);
  await db.delete(schema.marketingCampaigns);
}

async function seedCampaign(businessId, id, name) {
  await db.insert(schema.marketingCampaigns).values({
    id,
    businessId,
    name,
    objective: "leads",
    campaignType: "organic",
    status: "active",
    budgetCurrency: "USD",
    approvalStatus: "approved",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

test("executive report returns persisted tenant data only", async () => {
  await clearMarketingAnalyticsData();

  await seedCampaign("analytics-a", "campaign-a", "Campaign A");
  await seedCampaign("analytics-b", "campaign-b", "Campaign B");

  await db.insert(schema.marketingAttributions).values([
    {
      id: "attr-a",
      businessId: "analytics-a",
      campaignId: "campaign-a",
      leadId: "lead-a",
      eventType: "conversion",
      occurredAt: NOW,
      value: 250,
      currency: "GHS",
      createdAt: NOW,
    },
    {
      id: "attr-b",
      businessId: "analytics-b",
      campaignId: "campaign-b",
      leadId: "lead-b",
      eventType: "conversion",
      occurredAt: NOW,
      value: 999,
      currency: "USD",
      createdAt: NOW,
    },
  ]);

  const report = await getMarketingExecutiveReport(
    "analytics-a",
    { from: null, to: null },
  );

  assert.equal(report.summary.campaigns, 1);
  assert.equal(report.summary.attributionEvents, 1);
  assert.equal(report.summary.conversions, 1);
  assert.equal(report.summary.attributedLeads, 1);
  assert.equal(report.attributedValueByCurrency.GHS, 250);
  assert.equal(report.attributedValueByCurrency.USD, undefined);

  const serialized = JSON.stringify(report);

  assert.match(serialized, /Campaign A/);
  assert.doesNotMatch(serialized, /Campaign B/);
  assert.doesNotMatch(serialized, /attr-b/);
});

test("executive report keeps currencies separate instead of summing unlike currencies", async () => {
  await clearMarketingAnalyticsData();

  await seedCampaign("analytics-currency", "campaign-currency", "Currency Campaign");

  await db.insert(schema.marketingAttributions).values([
    {
      id: "currency-ghs",
      businessId: "analytics-currency",
      campaignId: "campaign-currency",
      eventType: "conversion",
      occurredAt: NOW,
      value: 500,
      currency: "GHS",
      createdAt: NOW,
    },
    {
      id: "currency-usd",
      businessId: "analytics-currency",
      campaignId: "campaign-currency",
      eventType: "conversion",
      occurredAt: NOW,
      value: 20,
      currency: "USD",
      createdAt: NOW,
    },
  ]);

  const report = await getMarketingExecutiveReport(
    "analytics-currency",
    { from: null, to: null },
  );

  assert.deepEqual(report.attributedValueByCurrency, {
    GHS: 500,
    USD: 20,
  });
});

test("executive report exposes persisted metrics and never invents provider KPIs", async () => {
  await clearMarketingAnalyticsData();

  await seedCampaign("analytics-metrics", "campaign-metrics", "Metrics Campaign");

  await db.insert(schema.marketingMetricSnapshots).values({
    id: "clicks-real",
    businessId: "analytics-metrics",
    campaignId: "campaign-metrics",
    metric: "clicks",
    value: 17,
    capturedAt: NOW,
    createdAt: NOW,
  });

  const report = await getMarketingExecutiveReport(
    "analytics-metrics",
    { from: null, to: null },
  );

  assert.deepEqual(
    report.metricAvailability.persistedMetrics,
    ["clicks"],
  );

  assert.equal(report.campaigns.length, 1);
  assert.equal(report.campaigns[0].persistedMetrics.length, 1);
  assert.equal(report.campaigns[0].persistedMetrics[0].metric, "clicks");
  assert.equal(report.campaigns[0].persistedMetrics[0].value, 17);

  const metrics = report.campaigns.flatMap((campaign) =>
    campaign.persistedMetrics.map((item) => item.metric),
  );

  assert.equal(metrics.includes("impressions"), false);
  assert.equal(metrics.includes("ctr"), false);
  assert.equal(metrics.includes("cpc"), false);
  assert.equal(metrics.includes("roas"), false);
});

test("executive report range filters attribution, metric and publishing records", async () => {
  await clearMarketingAnalyticsData();

  await seedCampaign("analytics-range", "campaign-range", "Range Campaign");

  const inside = new Date("2026-09-17T12:00:00.000Z");
  const outside = new Date("2026-08-01T12:00:00.000Z");

  await db.insert(schema.marketingAttributions).values([
    {
      id: "attr-inside",
      businessId: "analytics-range",
      campaignId: "campaign-range",
      eventType: "conversion",
      occurredAt: inside,
      createdAt: inside,
    },
    {
      id: "attr-outside",
      businessId: "analytics-range",
      campaignId: "campaign-range",
      eventType: "conversion",
      occurredAt: outside,
      createdAt: outside,
    },
  ]);

  await db.insert(schema.marketingMetricSnapshots).values([
    {
      id: "metric-inside",
      businessId: "analytics-range",
      campaignId: "campaign-range",
      metric: "clicks",
      value: 7,
      capturedAt: inside,
      createdAt: inside,
    },
    {
      id: "metric-outside",
      businessId: "analytics-range",
      campaignId: "campaign-range",
      metric: "clicks",
      value: 99,
      capturedAt: outside,
      createdAt: outside,
    },
  ]);

  const report = await getMarketingExecutiveReport(
    "analytics-range",
    {
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.999Z"),
    },
  );

  assert.equal(report.summary.attributionEvents, 1);
  assert.equal(report.summary.conversions, 1);

  assert.equal(report.campaigns.length, 1);
  assert.equal(report.campaigns[0].attributionEvents, 1);
  assert.equal(report.campaigns[0].conversions, 1);
  assert.equal(report.campaigns[0].persistedMetrics.length, 1);
  assert.equal(report.campaigns[0].persistedMetrics[0].metric, "clicks");
  assert.equal(report.campaigns[0].persistedMetrics[0].value, 7);
});

test("empty business returns truthful empty executive report", async () => {
  await clearMarketingAnalyticsData();

  const report = await getMarketingExecutiveReport(
    "analytics-empty",
    { from: null, to: null },
  );

  assert.equal(report.summary.campaigns, 0);
  assert.equal(report.summary.attributionEvents, 0);
  assert.equal(report.summary.conversions, 0);
  assert.equal(report.summary.attributedLeads, 0);
  assert.equal(report.summary.attributedCustomers, 0);
  assert.equal(report.summary.attributedDeals, 0);
  assert.deepEqual(report.attributedValueByCurrency, {});
  assert.deepEqual(report.campaigns, []);
  assert.deepEqual(report.channels, []);
  assert.deepEqual(report.metricAvailability.persistedMetrics, []);
  assert.equal(report.evidencePolicy.persistedOnly, true);
  assert.equal(report.evidencePolicy.attributedValueIsRevenue, false);
  assert.equal(report.evidencePolicy.providerMetricsInferred, false);
});
