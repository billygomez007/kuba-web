import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { listPlivoNumbers } from "@/lib/voice/adapters/plivo";

/**
 * Reads the numbers already purchased in the platform's Plivo account
 * (Phase 6) — never fabricated. Any authenticated business member with
 * workforce-view can see this list (it's used to pick a real number to
 * assign, not a secret), but PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN themselves
 * are never returned.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const numbers = await listPlivoNumbers();
    return NextResponse.json({ numbers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read Plivo phone numbers.", numbers: [] }, { status: 503 });
  }
}
