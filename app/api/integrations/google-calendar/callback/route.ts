import { NextResponse } from "next/server";
import { oauthConfig, verifyState, saveConnection, GOOGLE_SCOPES } from "@/lib/google-calendar";
import { createAuditLog } from "@/lib/auth/audit";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { headers } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url); const state = url.searchParams.get("state"); const code = url.searchParams.get("code"); const raw = state ? verifyState(state) : null;
  if (!raw || !code) return NextResponse.json({ error: "Invalid OAuth state or denied consent" }, { status: 400 });
  let payload: { businessId: string; userId?: string; exp: number }; try { payload = JSON.parse(Buffer.from(raw, "base64url").toString()) as typeof payload; } catch { return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 }); }
  if (!payload.businessId || payload.exp < Date.now()) return NextResponse.json({ error: "Expired OAuth state" }, { status: 400 });
  const session = await auth.api.getSession({ headers: await headers() });
  const membership = session?.user ? await getCurrentMembership() : null;
  if (!session?.user || session.user.id !== payload.userId || !membership || membership.businessId !== payload.businessId) return NextResponse.json({ error: "OAuth state is not valid for this business" }, { status: 403 });
  const cfg = oauthConfig(); const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" }) });
  if (!tokenRes.ok) return NextResponse.json({ error: "Google authorization failed" }, { status: 502 }); const token = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!token.refresh_token) return NextResponse.json({ error: "Google did not issue a refresh token; reconnect with consent" }, { status: 400 });
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } }); const info = infoRes.ok ? await infoRes.json() as { email?: string } : {};
  const credentials = { accessToken: token.access_token, refreshToken: token.refresh_token, expiry: Date.now() + (token.expires_in || 3600) * 1000, accountEmail: info.email, scopes: token.scope || GOOGLE_SCOPES };
  await saveConnection(payload.businessId, credentials, { accountEmail: info.email || null, scopes: token.scope || GOOGLE_SCOPES, connectedAt: new Date().toISOString(), lastSyncAt: null }); await createAuditLog({ businessId: payload.businessId, userId: payload.userId || null, action: "google_calendar.connected", resource: "integration", metadata: { provider: "google_calendar", accountEmail: info.email || null } });
  return NextResponse.redirect(new URL("/dashboard/integrations/calendar?connected=1", url.origin));
}
