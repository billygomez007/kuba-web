import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { planDefinitions } from "@/lib/billing/entitlements";
import { createAuditLog } from "@/lib/auth/audit";

export async function GET() { return NextResponse.json({ plans: planDefinitions }); }

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getBusinessMembership(session.user.id);
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const plan = planDefinitions.find((item) => item.id === body.plan);
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 400 });
  await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.upgrade.requested", resource: "business_plan", description: `Requested upgrade to ${plan.name}.`, metadata: { requestedPlan: plan.id } });
  return NextResponse.json({ success: true, status: "pending_billing_integration", requestedPlan: plan.id });
}
