import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/auth/audit";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { encryptVoiceSecret } from "@/lib/voice/secrets";
import { voiceProviders, getVoiceProvider } from "@/lib/voice/providers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const connections = await db.select({ id: integrations.id, provider: integrations.provider, status: integrations.status, externalAccountId: integrations.externalAccountId, displayName: integrations.displayName, metadata: integrations.metadata, updatedAt: integrations.updatedAt }).from(integrations).where(and(eq(integrations.businessId, membership.businessId), eq(integrations.metadata, "voice_provider")));
  return NextResponse.json({ providers: voiceProviders, connections });
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json();
    const provider = typeof body.provider === "string" ? body.provider : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    const secret = typeof body.secret === "string" ? body.secret : "";
    if (!getVoiceProvider(provider) || !accountId || !secret) return NextResponse.json({ error: "Provider, account identifier, and secret are required." }, { status: 400 });
    const existing = await db.select({ id: integrations.id }).from(integrations).where(and(eq(integrations.businessId, membership.businessId), eq(integrations.provider, provider), eq(integrations.metadata, "voice_provider"))).limit(1);
    const values = { status: "active", externalAccountId: accountId, credentialsEncrypted: encryptVoiceSecret(secret), metadata: "voice_provider", displayName: getVoiceProvider(provider)?.name, updatedAt: new Date() };
    const id = existing[0]?.id || crypto.randomUUID();
    if (existing[0]) await db.update(integrations).set(values).where(eq(integrations.id, id));
    else await db.insert(integrations).values({ id, businessId: membership.businessId, provider, ...values, createdAt: new Date() });
    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "voice.provider.connected", resource: "integration", resourceId: id, metadata: { provider, accountId } });
    return NextResponse.json({ success: true, id, provider, status: "active", accountId });
  } catch (error) {
    console.error("Voice provider connection error:", error);
    return NextResponse.json({ error: "Unable to connect voice provider." }, { status: 500 });
  }
}
