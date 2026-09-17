import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function requireMarketingAccess(
  mode: "view" | "manage" | "review" = "view",
) {
  const { user, membership, error } = await requireBusinessMembership();

  if (!user) {
    return {
      ok: false as const,
      status: 401 as const,
      error: error || "Unauthorized",
    };
  }

  if (!membership) {
    return {
      ok: false as const,
      status: 403 as const,
      error: error || "Business access denied.",
    };
  }

  const permission =
    mode === "review"
      ? PERMISSIONS.MARKETING_APPROVALS_REVIEW
      : mode === "manage"
        ? PERMISSIONS.MARKETING_MANAGE
        : PERMISSIONS.MARKETING_VIEW;

  if (!hasPermission(membership.role, membership.permissions, permission)) {
    return {
      ok: false as const,
      status: 403 as const,
      error:
        mode === "review"
          ? "You do not have permission to review Marketing approvals."
          : "You do not have permission to use Marketing.",
    };
  }

  return {
    ok: true as const,
    userId: user.id,
    businessId: membership.businessId,
    capabilities: {
      canManage: hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.MARKETING_MANAGE,
      ),
      canReviewApprovals: hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.MARKETING_APPROVALS_REVIEW,
      ),
    },
  };
}

export const MARKETING_CHANNELS = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube", "telegram", "email", "whatsapp", "website", "other"] as const;
export const MARKETING_CONTENT_TYPES = ["post", "story", "reel", "short_video", "long_video", "email", "ad_copy", "article", "graphic", "carousel", "other"] as const;
export const SAFE_AUDIENCE_FIELDS = ["lead_stage", "deal_stage", "customer_status", "product_interest", "source", "engagement_recency", "location", "tag", "repeat_customer"] as const;

export function jsonObject(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try { return JSON.stringify(value); } catch { return null; }
}

export function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
