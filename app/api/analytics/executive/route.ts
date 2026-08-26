import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, desc, lt } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { actionApprovals, automationRuns, followUps, handoffs, tasks } from "@/db/schema";

type BriefingItem = {
  id: string;
  category: "tasks" | "approvals" | "automations" | "customer_ops";
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: string;
  sourceDomain: string;
  href: string;
  generatedAt: string;
};

// Deterministic executive briefing: every item here is a direct count or
// row from real, selected-business-scoped records. No AI summarization, no
// invented signals — see PHASE 4 ("prefer deterministic intelligence
// first") of the Intelligence brief.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.ANALYTICS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "intelligence.advanced")) {
      return NextResponse.json({ error: "Executive Intelligence requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const businessId = business.businessId;
    const now = new Date();
    const generatedAt = now.toISOString();

    const [overdueTasks, pendingApprovals, failedRuns, overdueFollowUps, pendingHandoffs] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.businessId, businessId), lt(tasks.dueAt, now))).then((rows) => rows.filter((task) => !["completed", "cancelled"].includes(task.status))),
      db.select().from(actionApprovals).where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending"))).orderBy(desc(actionApprovals.createdAt)),
      db.select().from(automationRuns).where(and(eq(automationRuns.businessId, businessId), eq(automationRuns.status, "failed"))).orderBy(desc(automationRuns.startedAt)).limit(20),
      db.select().from(followUps).where(and(eq(followUps.businessId, businessId), lt(followUps.dueAt, now))).then((rows) => rows.filter((item) => item.status !== "completed")),
      db.select().from(handoffs).where(and(eq(handoffs.businessId, businessId), eq(handoffs.status, "pending"))),
    ]);

    const briefing: BriefingItem[] = [];

    if (overdueTasks.length > 0) {
      briefing.push({
        id: "overdue-tasks",
        category: "tasks",
        severity: overdueTasks.length >= 5 ? "high" : "medium",
        title: `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} overdue`,
        explanation: "These tasks have passed their due date and remain open.",
        evidence: overdueTasks.slice(0, 3).map((task) => task.title).join(", "),
        sourceDomain: "Business Operations",
        href: "/dashboard/tasks",
        generatedAt,
      });
    }

    if (pendingApprovals.length > 0) {
      briefing.push({
        id: "pending-approvals",
        category: "approvals",
        severity: "medium",
        title: `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} awaiting decision`,
        explanation: "AI-requested customer communication actions are waiting for human review.",
        evidence: pendingApprovals.slice(0, 3).map((approval) => `${approval.channel} to ${approval.recipient}`).join(", "),
        sourceDomain: "Business Operations",
        href: "/dashboard/approvals",
        generatedAt,
      });
    }

    if (failedRuns.length > 0) {
      briefing.push({
        id: "failed-automations",
        category: "automations",
        severity: failedRuns.length >= 3 ? "high" : "medium",
        title: `${failedRuns.length} automation run${failedRuns.length === 1 ? "" : "s"} failed`,
        explanation: "Recent automation executions did not complete successfully.",
        evidence: failedRuns.slice(0, 3).map((run) => run.error || `Run ${run.id}`).join("; "),
        sourceDomain: "Business Operations",
        href: "/dashboard/automations",
        generatedAt,
      });
    }

    if (overdueFollowUps.length > 0) {
      briefing.push({
        id: "overdue-followups",
        category: "customer_ops",
        severity: overdueFollowUps.length >= 5 ? "high" : "medium",
        title: `${overdueFollowUps.length} customer follow-up${overdueFollowUps.length === 1 ? "" : "s"} overdue`,
        explanation: "Scheduled follow-ups with leads or customers have passed their due date.",
        evidence: `${overdueFollowUps.length} follow-up record(s) past due`,
        sourceDomain: "Customer Operations",
        href: "/dashboard/follow-ups",
        generatedAt,
      });
    }

    if (pendingHandoffs.length > 0) {
      briefing.push({
        id: "pending-handoffs",
        category: "customer_ops",
        severity: "medium",
        title: `${pendingHandoffs.length} conversation handoff${pendingHandoffs.length === 1 ? "" : "s"} waiting`,
        explanation: "Conversations flagged for human takeover have not yet been picked up.",
        evidence: `${pendingHandoffs.length} handoff(s) pending`,
        sourceDomain: "Customer Operations",
        href: "/dashboard/handoffs",
        generatedAt,
      });
    }

    const severityRank = { high: 0, medium: 1, low: 2 } as const;
    briefing.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    return NextResponse.json({
      status: briefing.some((item) => item.severity === "high") ? "needs_attention" : briefing.length > 0 ? "monitor" : "steady",
      briefing,
      generatedAt,
    });
  } catch (error) {
    console.error("Executive Intelligence error:", error);
    return NextResponse.json({ error: "Unable to load Executive Intelligence." }, { status: 500 });
  }
}
