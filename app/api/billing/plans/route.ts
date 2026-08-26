import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessPlan, normalizePlan, planDefinitions, planOrder } from "@/lib/billing/entitlements";
import { createAuditLog } from "@/lib/auth/audit";

export async function GET() { return NextResponse.json({ plans: planDefinitions }); }

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getBusinessMembership(session.user.id);
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.BILLING_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const requestedPlan = normalizePlan(typeof body.plan === "string" ? body.plan : "");
  const plan = planDefinitions.find((item) => item.id === requestedPlan);
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 400 });
  if (requestedPlan === "enterprise") return NextResponse.json({ error: "Enterprise plans require a sales conversation.", contactSales: true }, { status: 400 });
  const currentPlan = await getBusinessPlan(membership.businessId);
  if (planOrder.indexOf(requestedPlan) <= planOrder.indexOf(currentPlan.id)) return NextResponse.json({ error: "Plan requests must be upgrades. Downgrades require provider support.", code: "PLAN_CHANGE_NOT_SUPPORTED" }, { status: 409 });
  await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.upgrade.requested", resource: "business_plan", description: `Requested upgrade to ${plan.name}.`, metadata: { requestedPlan: plan.id } });
  return NextResponse.json({ success: true, status: "pending_billing_integration", requestedPlan: plan.id });
}
