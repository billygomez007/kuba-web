import { describe, it, expect } from "vitest";

import { computeGrowthOpportunities } from "@/mastra/tools/marketing/get-growth-opportunities";

const now = new Date("2026-08-29T00:00:00Z");
const day = 24 * 60 * 60 * 1000;

describe("computeGrowthOpportunities", () => {
  it("returns no opportunities from empty data (never fabricates)", () => {
    const opportunities = computeGrowthOpportunities([], [], [], now);
    expect(opportunities).toEqual([]);
  });

  it("flags uncontacted (new) leads using only real counts", () => {
    const leads = [
      { id: "1", name: "A", service: null, stage: "new", source: "web", createdAt: now, updatedAt: now },
      { id: "2", name: "B", service: null, stage: "new", source: "web", createdAt: now, updatedAt: now },
    ];
    const opportunities = computeGrowthOpportunities(leads, [], [], now);
    const uncontacted = opportunities.find((item) => item.opportunity.includes("not yet been contacted"));
    expect(uncontacted).toBeDefined();
    expect(uncontacted!.evidence).toContain("2");
    expect(uncontacted!.approvalRequired).toBe(true);
  });

  it("does not flag uncontacted leads when there are none", () => {
    const leads = [
      { id: "1", name: "A", service: null, stage: "qualified", source: "web", createdAt: now, updatedAt: now },
    ];
    const opportunities = computeGrowthOpportunities(leads, [], [], now);
    expect(opportunities.some((item) => item.opportunity.includes("not yet been contacted"))).toBe(false);
  });

  it("flags overdue pending follow-ups but not completed or future ones", () => {
    const followUps = [
      { id: "f1", leadId: "1", status: "pending", dueAt: new Date(now.getTime() - 2 * day) },
      { id: "f2", leadId: "2", status: "completed", dueAt: new Date(now.getTime() - 5 * day) },
      { id: "f3", leadId: "3", status: "pending", dueAt: new Date(now.getTime() + 5 * day) },
    ];
    const opportunities = computeGrowthOpportunities([], followUps, [], now);
    const overdue = opportunities.find((item) => item.opportunity.includes("overdue"));
    expect(overdue).toBeDefined();
    expect(overdue!.evidence).toContain("1");
    expect(overdue!.approvalRequired).toBe(false);
  });

  it("flags a dominant requested service only when volume is meaningful", () => {
    const leads = Array.from({ length: 4 }, (_, index) => ({
      id: String(index),
      name: `Lead ${index}`,
      service: "Visa consulting",
      stage: "contacted",
      source: "referral",
      createdAt: now,
      updatedAt: now,
    }));
    const opportunities = computeGrowthOpportunities(leads, [], [], now);
    expect(opportunities.some((item) => item.opportunity.includes("Visa consulting"))).toBe(true);
  });

  it("flags dormant customers based on real updatedAt age", () => {
    const customers = [
      { id: "c1", updatedAt: new Date(now.getTime() - 120 * day) },
      { id: "c2", updatedAt: new Date(now.getTime() - 5 * day) },
    ];
    const opportunities = computeGrowthOpportunities([], [], customers, now);
    const dormant = opportunities.find((item) => item.opportunity.includes("not engaged"));
    expect(dormant).toBeDefined();
    expect(dormant!.evidence).toContain("1");
  });
});
