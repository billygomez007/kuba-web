import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("./test-db");
  const db = await createTestDb();
  return { db };
});

// Imported AFTER the mock is registered so every tool below shares the same
// in-memory database instance (vi.mock is hoisted above these imports).
import { db } from "@/db";
import * as schema from "@/db/schema";
import type { TestDb } from "./test-db";

import { getGrowthOpportunitiesTool } from "../get-growth-opportunities";
import { getCustomerSummaryTool } from "../get-customer-summary";
import { getMarketingPerformanceTool } from "../get-marketing-performance";
import { getPendingMarketingApprovalsTool } from "../get-pending-marketing-approvals";
import { createCampaignBriefTool } from "../create-campaign-brief";
import { createContentDraftTool } from "../create-content-draft";
import { createContentCalendarTool } from "../create-content-calendar";
import { createAudiencePlanTool } from "../create-audience-plan";
import { createExperimentPlanTool } from "../create-experiment-plan";
import { createExecutiveMarketingBriefTool } from "../create-executive-marketing-brief";
import { createMarketingTaskTool } from "../create-marketing-task";
import { requestMarketingApprovalTool } from "../request-marketing-approval";
import { handoffLeadToSalesTool } from "../handoff-lead-to-sales";

const typedDb = db as unknown as TestDb;

function ctx(businessId: string) {
  return { requestContext: new RequestContext([["businessId", businessId]]) } as any;
}

async function seedBusiness(id: string, plan: "starter" | "growth" | "pro") {
  const now = new Date();
  await typedDb.insert(schema.businesses).values({
    id,
    name: `Business ${id}`,
    slug: id,
    plan,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedMarketingEmployee(businessId: string, employeeId: string) {
  const now = new Date();
  await typedDb.insert(schema.aiEmployees).values({
    id: employeeId,
    businessId,
    name: "Kuba Marketing",
    type: "marketing",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedSalesEmployee(businessId: string, employeeId: string) {
  const now = new Date();
  await typedDb.insert(schema.aiEmployees).values({
    id: employeeId,
    businessId,
    name: "Kuba Sales",
    type: "sales",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedLead(businessId: string, id: string, name: string, stage = "new") {
  const now = new Date();
  await typedDb.insert(schema.leads).values({
    id,
    businessId,
    name,
    stage,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Marketing AI tools — tenant isolation, entitlement, and safety", () => {
  const businessA = "biz-a";
  const businessB = "biz-b";
  const starterBiz = "biz-starter";

  beforeAll(async () => {
    await seedBusiness(businessA, "growth");
    await seedBusiness(businessB, "growth");
    await seedBusiness(starterBiz, "starter");

    await seedMarketingEmployee(businessA, "emp-marketing-a");
    await seedMarketingEmployee(businessB, "emp-marketing-b");

    await seedLead(businessA, "lead-a1", "Lead A1");
    await seedLead(businessB, "lead-b1", "Lead B1");
  });

  it("entitlement: starter plan is denied marketing tools", async () => {
    const result = (await getGrowthOpportunitiesTool.execute!({}, ctx(starterBiz))) as any;
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Growth/);
  });

  it("entitlement: growth plan is allowed basic marketing tools", async () => {
    const result = (await getGrowthOpportunitiesTool.execute!({}, ctx(businessA))) as any;
    expect(result.success).toBe(true);
  });

  it("entitlement: growth plan is denied advanced marketing tools, pro is allowed", async () => {
    const briefInput = {
      campaignName: "Launch",
      businessObjective: "Grow leads",
      targetAudience: "Existing customers",
      customerProblem: "Awareness",
      offer: "None",
      positioning: "Trusted local expert",
      coreMessage: "We help you grow",
      supportingMessages: [],
      channels: ["email"],
      cta: "Book now",
      contentAssetsRequired: [],
      campaignDuration: "30 days",
      leadFollowUpStrategy: "Sales follow-up within 24h",
      salesHandoffStrategy: "Handoff on reply",
      kpis: [],
      assumptions: [],
      risks: [],
    };

    const denied = (await createCampaignBriefTool.execute!(briefInput, ctx(businessA))) as any;
    expect(denied.success).toBe(false);
    expect(denied.error).toMatch(/Pro/);

    await seedBusiness("biz-pro", "pro");
    await seedMarketingEmployee("biz-pro", "emp-marketing-pro");
    const allowed = (await createCampaignBriefTool.execute!(briefInput, ctx("biz-pro"))) as any;
    expect(allowed.success).toBe(true);
    expect(allowed.status).toBe("draft");
  });

  it("tenant isolation: growth opportunities only reflect the requesting business's leads", async () => {
    const resultA = (await getGrowthOpportunitiesTool.execute!({}, ctx(businessA))) as any;
    expect(resultA.dataSources.leadsAnalyzed).toBe(1);

    const resultB = (await getGrowthOpportunitiesTool.execute!({}, ctx(businessB))) as any;
    expect(resultB.dataSources.leadsAnalyzed).toBe(1);
  });

  it("tenant isolation: a lead-name handoff cannot reach another business's lead", async () => {
    const result = (await handoffLeadToSalesTool.execute!(
      { leadName: "Lead B1", leadInterest: "Test", suggestedTalkingPoint: "Hi" },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("stale/missing context is rejected", async () => {
    const emptyContext = { requestContext: new RequestContext([]) } as any;
    await expect(getGrowthOpportunitiesTool.execute!({}, emptyContext)).rejects.toThrow();
  });

  it("a businessId injected into tool input is ignored — only the trusted RequestContext is used", async () => {
    const result = (await getGrowthOpportunitiesTool.execute!({ businessId: businessB } as any, ctx(businessA))) as any;
    expect(result.dataSources.leadsAnalyzed).toBe(1); // business A has 1 lead, not business B's
  });

  it("honest analytics: campaign performance is always reported as not connected, never fabricated", async () => {
    const result = (await getMarketingPerformanceTool.execute!({}, ctx(businessA))) as any;
    expect(result.connected).toBe(false);
    expect(result.message).toMatch(/not currently connected/);
  });

  it("draft tools never publish or send: content draft is stored as a draft only", async () => {
    const result = (await createContentDraftTool.execute!(
      { channel: "instagram", body: "Check out our new service!" },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.status).toBe("draft");
    expect(result.message).toMatch(/not been published or sent/);
  });

  it("approval boundary: requesting a send only creates a pending approval, never sends", async () => {
    const result = (await requestMarketingApprovalTool.execute!(
      { channel: "whatsapp", recipient: "all customers", message: "50% off this week" },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.status).toBe("approval_required");

    const pending = (await getPendingMarketingApprovalsTool.execute!({}, ctx(businessA))) as any;
    expect(pending.count).toBeGreaterThanOrEqual(1);
    expect(pending.pendingApprovals.some((item: any) => item.id === result.approvalId)).toBe(true);
  });

  it("approvals are tenant-scoped: business B never sees business A's pending approvals", async () => {
    const pendingB = (await getPendingMarketingApprovalsTool.execute!({}, ctx(businessB))) as any;
    expect(pendingB.count).toBe(0);
  });

  it("audience plan rejects segments built on protected characteristics", async () => {
    const result = (await createAudiencePlanTool.execute!(
      { segments: [{ name: "Group", definition: "Customers of a specific religion", rationale: "assumed interest" }] },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("audience plan accepts lawful segments", async () => {
    const result = (await createAudiencePlanTool.execute!(
      { segments: [{ name: "New leads", definition: "Leads with stage new", rationale: "First-contact opportunity" }] },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(true);
  });

  it("experiment plan never claims results", async () => {
    const result = (await createExperimentPlanTool.execute!(
      {
        experimentName: "Subject line test",
        hypothesis: "Shorter subject lines improve opens",
        variable: "Subject line length",
        control: "Long subject line",
        variant: "Short subject line",
        primaryMetric: "Open rate",
        durationRecommendation: "2 weeks",
        successCondition: "Variant open rate exceeds control by 10%",
      },
      ctx("biz-pro"),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.experiment.resultsAvailable).toBeUndefined(); // input echo, not a fabricated result
  });

  it("content calendar entries are draft/not-submitted, never scheduled or published", async () => {
    const result = (await createContentCalendarTool.execute!(
      {
        calendarName: "Launch week",
        period: "7-day",
        entries: [{ date: "2026-09-01", channel: "instagram", theme: "Awareness", contentFormat: "Reel" }],
      },
      ctx("biz-pro"),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.entries[0].status).toBe("draft");
    expect(result.entries[0].approvalState).toBe("not_submitted");
  });

  it("marketing task creation reuses the existing tasks table and is tenant-scoped", async () => {
    const result = (await createMarketingTaskTool.execute!(
      { title: "Review Q4 content calendar", priority: "normal" },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(true);

    const rows = await typedDb.select().from(schema.tasks).where(eq(schema.tasks.businessId, businessA));
    expect(rows.some((row) => row.id === result.taskId)).toBe(true);
  });

  it("sales handoff creates a structured internal follow-up, not a customer message", async () => {
    await seedSalesEmployee(businessA, "emp-sales-a");
    const result = (await handoffLeadToSalesTool.execute!(
      {
        leadName: "Lead A1",
        campaignSource: "Instagram launch campaign",
        leadInterest: "Visa consulting",
        suggestedTalkingPoint: "Ask about their intended intake date.",
      },
      ctx(businessA),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.assignedToSalesEmployee).toBe(true);

    const followUps = await typedDb.select().from(schema.followUps).where(eq(schema.followUps.leadId, "lead-a1"));
    expect(followUps).toHaveLength(1);
    expect(followUps[0].description).toContain("Instagram launch campaign");
    expect(followUps[0].assignedEmployeeId).toBe("emp-sales-a");
  });

  it("customer summary only reads the requesting business's customers", async () => {
    await typedDb.insert(schema.customers).values({
      id: "cust-a1",
      businessId: businessA,
      name: "Jane",
      source: "referral",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const resultA = (await getCustomerSummaryTool.execute!({}, ctx(businessA))) as any;
    expect(resultA.totalCustomers).toBe(1);

    const resultB = (await getCustomerSummaryTool.execute!({}, ctx(businessB))) as any;
    expect(resultB.totalCustomers).toBe(0);
  });

  it("executive marketing brief aggregates only real, tenant-scoped data and does not include fabricated metrics", async () => {
    await seedBusiness("biz-exec", "pro");
    await seedMarketingEmployee("biz-exec", "emp-marketing-exec");
    await seedLead("biz-exec", "lead-exec-1", "Lead Exec 1");

    const result = (await createExecutiveMarketingBriefTool.execute!({}, ctx("biz-exec"))) as any;
    expect(result.success).toBe(true);
    expect(result.pipeline.totalLeads).toBe(1);
    expect(result.note).toMatch(/not included/);
  });
});
