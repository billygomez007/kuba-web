import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployeeSettings, aiEmployees, businessUsers } from "@/db/schema";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getVoiceProvider, voiceProviders } from "@/lib/voice/providers";
import { createAuditLog } from "@/lib/auth/audit";
import { canUseFeature, getBusinessPlan } from "@/lib/billing/entitlements";

const marker = "\n\nVoice capability configuration:\n";

type VoiceConfig = {
  enabled: boolean;
  phoneNumber: string;
  callDirection: "inbound" | "outbound" | "both";
  provider: string;
  voiceModel: string;
  language: string;
  accent: string;
  speakingStyle: string;
  tone: string;
  speed: number;
  workingHours: string;
  maxDailyCalls: number;
  maxCallDurationMinutes: number;
  allowedCallTypes: string[];
  callPermissions: string[];
  humanTransferRules: string[];
  transferDestination: string;
  automationEvents: string[];
};

const defaultConfig: VoiceConfig = {
  enabled: false,
  phoneNumber: "",
  callDirection: "both",
  provider: "",
  voiceModel: "",
  language: "English",
  accent: "Neutral",
  speakingStyle: "Professional",
  tone: "Warm and clear",
  speed: 1,
  workingHours: "Business hours",
  maxDailyCalls: 100,
  maxCallDurationMinutes: 30,
  allowedCallTypes: ["Customer enquiries", "Appointments", "Support callbacks"],
  callPermissions: ["Answer calls", "Provide information"],
  humanTransferRules: ["Customer requests a human", "Complaint detected"],
  transferDestination: "Business owner",
  automationEvents: ["call.started", "call.completed", "call.missed", "customer.requested_callback", "call.escalated"],
};

function parseConfig(value: string | null): VoiceConfig {
  if (!value || !value.includes(marker)) return defaultConfig;
  try {
    return { ...defaultConfig, ...JSON.parse(value.slice(value.indexOf(marker) + marker.length)) };
  } catch {
    return defaultConfig;
  }
}

async function getEmployee(userId: string, employeeId: string) {
  const membership = await getBusinessMembership(userId);
  if (!membership) return null;
  const employee = await db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status, businessId: aiEmployees.businessId }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, membership.businessId))).limit(1);
  return employee[0] ? { membership, employee: employee[0] } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const data = await getEmployee(session.user.id, id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const settings = await db.select({ roleInstructions: aiEmployeeSettings.roleInstructions }).from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1);
    return NextResponse.json({ employee: data.employee, config: parseConfig(settings[0]?.roleInstructions || null), providers: voiceProviders });
  } catch (error) {
    console.error("Voice configuration GET error:", error);
    return NextResponse.json({ error: "Unable to load voice configuration." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const data = await getEmployee(session.user.id, id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "You do not have permission to configure voice." }, { status: 403 });

    const body = await request.json();
    const config: VoiceConfig = {
      enabled: body.enabled === true,
      phoneNumber: typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "",
      callDirection: body.callDirection === "inbound" || body.callDirection === "outbound" ? body.callDirection : "both",
      provider: typeof body.provider === "string" ? body.provider.trim() : "",
      voiceModel: typeof body.voiceModel === "string" ? body.voiceModel.trim() : "",
      language: typeof body.language === "string" ? body.language.trim() : "English",
      accent: typeof body.accent === "string" ? body.accent.trim() : "Neutral",
      speakingStyle: typeof body.speakingStyle === "string" ? body.speakingStyle.trim() : "Professional",
      tone: typeof body.tone === "string" ? body.tone.trim() : "Warm and clear",
      speed: typeof body.speed === "number" && body.speed >= 0.5 && body.speed <= 2 ? body.speed : 1,
      workingHours: typeof body.workingHours === "string" ? body.workingHours.trim() : "Business hours",
      maxDailyCalls: typeof body.maxDailyCalls === "number" && body.maxDailyCalls > 0 ? Math.floor(body.maxDailyCalls) : 100,
      maxCallDurationMinutes: typeof body.maxCallDurationMinutes === "number" && body.maxCallDurationMinutes > 0 ? Math.floor(body.maxCallDurationMinutes) : 30,
      allowedCallTypes: Array.isArray(body.allowedCallTypes) ? body.allowedCallTypes.filter((value: unknown): value is string => typeof value === "string") : [],
      callPermissions: Array.isArray(body.callPermissions) ? body.callPermissions.filter((value: unknown): value is string => typeof value === "string") : [],
      humanTransferRules: Array.isArray(body.humanTransferRules) ? body.humanTransferRules.filter((value: unknown): value is string => typeof value === "string") : [],
      transferDestination: typeof body.transferDestination === "string" ? body.transferDestination.trim() : "Business owner",
      automationEvents: Array.isArray(body.automationEvents) ? body.automationEvents.filter((value: unknown): value is string => typeof value === "string") : [],
    };

    const plan = await getBusinessPlan(data.employee.businessId);
    if (config.enabled && !canUseFeature(plan, "voice")) return NextResponse.json({ error: "Voice is available as a paid add-on on this plan.", upgradeRequired: true }, { status: 403 });
    if (config.enabled && (!config.provider || !getVoiceProvider(config.provider))) return NextResponse.json({ error: "Choose a supported voice provider before enabling Voice." }, { status: 400 });
    const existing = await db.select({ id: aiEmployeeSettings.id, roleInstructions: aiEmployeeSettings.roleInstructions }).from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1);
    const current = existing[0]?.roleInstructions || "";
    const base = current.includes(marker) ? current.slice(0, current.indexOf(marker)) : current;
    const roleInstructions = `${base}${marker}${JSON.stringify(config)}`;
    const now = new Date();
    if (existing[0]) await db.update(aiEmployeeSettings).set({ roleInstructions, updatedAt: now }).where(eq(aiEmployeeSettings.id, existing[0].id));
    else await db.insert(aiEmployeeSettings).values({ id: crypto.randomUUID(), employeeId: id, roleInstructions, createdAt: now, updatedAt: now });
    await createAuditLog({
      businessId: data.employee.businessId,
      userId: session.user.id,
      action: config.enabled ? "voice.enabled" : "voice.configuration.updated",
      resource: "ai_employee_voice",
      resourceId: id,
      description: "Updated voice communication capability for an AI employee.",
      metadata: { provider: config.provider, callDirection: config.callDirection, enabled: config.enabled },
    });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Voice configuration POST error:", error);
    return NextResponse.json({ error: "Unable to save voice configuration." }, { status: 500 });
  }
}
