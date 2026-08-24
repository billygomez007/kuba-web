import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations, aiEmployees } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

async function context() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const membership = await getBusinessMembership(session.user.id);
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { membership };
}

export async function GET() {
  const value = await context();
  if (value.error) return value.error;
  const rows = await db.select({ id: integrations.id, number: integrations.externalPhoneNumberId, provider: integrations.provider, status: integrations.status, metadata: integrations.metadata }).from(integrations).where(eq(integrations.businessId, value.membership.businessId));
  const numbers = rows.filter((row) => { try { return JSON.parse(row.metadata || "{}").kind === "voice_phone"; } catch { return false; } });
  return NextResponse.json({ numbers });
}

export async function POST(request: Request) {
  const value = await context();
  if (value.error) return value.error;
  if (!hasPermission(value.membership.role, value.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const number = typeof body.number === "string" ? body.number.trim() : "";
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  if (!number || !provider) return NextResponse.json({ error: "Phone number and provider are required." }, { status: 400 });
  if (employeeId) {
    const employee = await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, value.membership.businessId))).limit(1);
    if (!employee[0]) return NextResponse.json({ error: "Employee does not belong to this business." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await db.insert(integrations).values({ id, businessId: value.membership.businessId, provider, status: employeeId ? "active" : "available", externalPhoneNumberId: number, metadata: JSON.stringify({ kind: "voice_phone", employeeId }), createdAt: new Date(), updatedAt: new Date() });
  return NextResponse.json({ success: true, id });
}