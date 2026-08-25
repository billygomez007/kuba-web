import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiEmployeeSettings,
  aiEmployees,
  businessLocalization,
  businessUsers,
  integrations,
  users,
} from "@/db/schema";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

async function getContext(employeeId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const employee = await db
    .select({
      id: aiEmployees.id,
      name: aiEmployees.name,
      type: aiEmployees.type,
      status: aiEmployees.status,
      businessId: aiEmployees.businessId,
    })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, membership.businessId)))
    .limit(1);

  if (!employee[0]) return null;
  return { membership, employee: employee[0] };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const data = await getContext(id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const [settings, connections, localization, teamMembers] = await Promise.all([
      db.select().from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, data.membership.businessId)),
      db.select({ country: businessLocalization.country, timezone: businessLocalization.timezone, language: businessLocalization.language }).from(businessLocalization).where(eq(businessLocalization.businessId, data.membership.businessId)).limit(1),
      db.select({ userId: users.id, name: users.name, email: users.email }).from(businessUsers).innerJoin(users, eq(users.id, businessUsers.userId)).where(eq(businessUsers.businessId, data.membership.businessId)),
    ]);

    return NextResponse.json({
      employee: data.employee,
      settings: settings[0] || null,
      channels: ["website", "whatsapp", "instagram", "facebook", "telegram", "email", "voice"].map((channel) => ({
        id: channel,
        name: channel === "website" ? "Website Chat" : channel === "facebook" ? "Facebook Messenger" : channel.charAt(0).toUpperCase() + channel.slice(1),
        status: channel === "voice" ? "requires_setup" : connections.some((item) => item.provider === channel && item.status === "active") ? "connected" : "not_connected",
      })),
      timezone: localization[0]?.timezone || "Not configured",
      teamMembers,
    });
  } catch (error) {
    console.error("Employee deployment GET error:", error);
    return NextResponse.json({ error: "Unable to load deployment settings." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const data = await getContext(id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) {
      return NextResponse.json({ error: "You do not have permission to configure this employee." }, { status: 403 });
    }

    const body = await request.json();
    const workingHours = typeof body.workingHours === "string" ? body.workingHours.trim() : "";
    const escalationRules = Array.isArray(body.escalationRules) ? body.escalationRules.filter((item: unknown): item is string => typeof item === "string") : [];
    const responsibilities = Array.isArray(body.responsibilities) ? body.responsibilities.filter((item: unknown): item is string => typeof item === "string") : [];
    const communicationStyle = typeof body.communicationStyle === "string" ? body.communicationStyle.trim() : "";
    const supervisorUserId = typeof body.supervisorUserId === "string" ? body.supervisorUserId.trim() : "";

    if (supervisorUserId) {
      const supervisor = await db.select({ id: businessUsers.id }).from(businessUsers).where(and(eq(businessUsers.userId, supervisorUserId), eq(businessUsers.businessId, data.membership.businessId))).limit(1);
      if (!supervisor[0]) return NextResponse.json({ error: "Escalation contact must belong to this business." }, { status: 400 });
    }

    const existing = await db.select({ id: aiEmployeeSettings.id }).from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1);
    const values = {
      workingHours: workingHours || null,
      escalationRules: escalationRules.join("\n") || null,
      responsibilities: responsibilities.join("\n") || null,
      communicationStyle: communicationStyle || null,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await db.update(aiEmployeeSettings).set(values).where(eq(aiEmployeeSettings.id, existing[0].id));
    } else {
      await db.insert(aiEmployeeSettings).values({ id: crypto.randomUUID(), employeeId: id, ...values, createdAt: new Date() });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee deployment POST error:", error);
    return NextResponse.json({ error: "Unable to save deployment settings." }, { status: 500 });
  }
}
