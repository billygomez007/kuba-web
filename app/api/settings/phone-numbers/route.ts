import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations, aiEmployees, aiEmployeeSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getVoiceProvider } from "@/lib/voice/providers";
import { parseVoiceConfig } from "@/lib/voice/employee-config";
import { isPhoneNumberAlreadyRegistered } from "@/lib/voice/tenant";
import { normalizePhoneNumber } from "@/lib/voice/phone";
import { hasCapability, getBusinessEntitlements } from "@/lib/billing/entitlements";

async function context() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const membership = await getCurrentMembership();
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
  const rawNumber = typeof body.number === "string" ? body.number.trim() : "";
  const number = normalizePhoneNumber(rawNumber);
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  if (!number || !provider) return NextResponse.json({ error: "Phone number and provider are required." }, { status: 400 });

  // Phase 7's assignment safety checks — all enforced server-side, none
  // merely implied by the UI.
  const providerDefinition = getVoiceProvider(provider);
  if (!providerDefinition || providerDefinition.status !== "available") {
    return NextResponse.json({ error: "This voice provider is not available yet." }, { status: 400 });
  }
  if (await isPhoneNumberAlreadyRegistered(provider, number, value.membership.businessId)) {
    return NextResponse.json({ error: "This number is already registered to another business." }, { status: 409 });
  }
  if (employeeId) {
    const employeeRows = await db.select({ id: aiEmployees.id, status: aiEmployees.status }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, value.membership.businessId))).limit(1);
    const employee = employeeRows[0];
    if (!employee) return NextResponse.json({ error: "Employee does not belong to this business." }, { status: 400 });
    if (employee.status !== "active") return NextResponse.json({ error: "This employee is not active." }, { status: 400 });
    const settingsRows = await db.select({ roleInstructions: aiEmployeeSettings.roleInstructions }).from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, employeeId)).limit(1);
    const voiceConfig = parseVoiceConfig(settingsRows[0]?.roleInstructions);
    if (!voiceConfig.enabled) return NextResponse.json({ error: "Voice is not enabled for this employee yet — configure it under the employee's Voice settings first." }, { status: 400 });
    if (!hasCapability(await getBusinessEntitlements(value.membership.businessId), "ai_workforce.voice")) {
      return NextResponse.json({ error: "Voice requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true }, { status: 403 });
    }
  }

  const id = crypto.randomUUID();
  await db.insert(integrations).values({ id, businessId: value.membership.businessId, provider, status: employeeId ? "active" : "available", externalPhoneNumberId: number, metadata: JSON.stringify({ kind: "voice_phone", employeeId }), createdAt: new Date(), updatedAt: new Date() });
  return NextResponse.json({ success: true, id });
}