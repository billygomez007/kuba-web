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

// Platform-managed providers (see lib/voice/providers.ts's credentialModel)
// never get a per-business "connection" row — their readiness is a
// platform-wide fact (do the required env vars exist?), never something
// an individual business configures. Checked by presence only; values
// are never returned to the client.
function isPlatformProviderConfigured(id: string): boolean {
  if (id === "plivo") return Boolean(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN);
  if (id === "twilio") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  if (id === "openai-realtime") return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const connections = await db.select({ id: integrations.id, provider: integrations.provider, status: integrations.status, externalAccountId: integrations.externalAccountId, displayName: integrations.displayName, metadata: integrations.metadata, updatedAt: integrations.updatedAt }).from(integrations).where(and(eq(integrations.businessId, membership.businessId), eq(integrations.metadata, "voice_provider")));
  const platformStatus = Object.fromEntries(
    voiceProviders.filter((provider) => provider.credentialModel === "platform").map((provider) => [provider.id, isPlatformProviderConfigured(provider.id) ? "connected" : "not_configured"]),
  );
  return NextResponse.json({ providers: voiceProviders, connections, platformStatus });
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
    const providerDefinition = getVoiceProvider(provider);
    if (!providerDefinition || !accountId || !secret) return NextResponse.json({ error: "Provider, account identifier, and secret are required." }, { status: 400 });
    // A "planned" provider has no working call transport yet (see
    // lib/voice/providers.ts) — saving credentials for one would show a
    // false "active" connection that can never place or receive a call.
    if (providerDefinition.status !== "available") return NextResponse.json({ error: `${providerDefinition.name} is not available yet — it's on the roadmap but has no working call transport.` }, { status: 400 });
    // Platform-managed providers never read a per-business credential —
    // saving one here would show a false "Connected" state (see
    // lib/voice/providers.ts's credentialModel comment).
    if (providerDefinition.credentialModel !== "business") return NextResponse.json({ error: `${providerDefinition.name} is configured by the SuperKuba platform, not by individual businesses. Contact your platform operator if it shows as unavailable.` }, { status: 400 });
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
