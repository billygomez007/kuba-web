import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Shared authorization for every Campaign Engine route (section 41):
 * authenticated user -> business membership -> OUTREACH permission. The
 * businessId this resolves to comes from the server-side session/cookie
 * membership lookup, never from client-supplied input — every route below
 * must use membership.businessId, never a businessId read from the request
 * body/query/params.
 */
export type CampaignRouteContext =
  | { ok: true; userId: string; businessId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireCampaignAccess(action: "view" | "manage" = "manage"): Promise<CampaignRouteContext> {
  const { user, membership, error } = await requireBusinessMembership();

  if (!user) {
    return { ok: false, status: 401, error: error || "Unauthorized" };
  }
  if (!membership) {
    return { ok: false, status: 403, error: error || "Business access denied." };
  }

  const requiredPermission = action === "manage" ? PERMISSIONS.OUTREACH_MANAGE : PERMISSIONS.OUTREACH_VIEW;
  if (!hasPermission(membership.role, membership.permissions, requiredPermission)) {
    return { ok: false, status: 403, error: "You do not have permission to manage Outreach campaigns." };
  }

  return { ok: true, userId: user.id, businessId: membership.businessId };
}
