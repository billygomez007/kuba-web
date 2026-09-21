import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-definitions";
import { requireBusinessMembership } from "@/lib/auth/tenant";

export async function requirePostizAccess(mode: "view" | "manage") {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return {
      ok: false as const,
      status: context.error === "Unauthorized" ? 401 : 403,
      error: context.error || "Business access denied.",
    };
  }

  const permission =
    mode === "manage"
      ? PERMISSIONS.INTEGRATIONS_MANAGE
      : PERMISSIONS.INTEGRATIONS_VIEW;

  if (
    !hasPermission(
      context.membership.role,
      context.membership.permissions,
      permission,
    )
  ) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have permission to manage this integration.",
    };
  }

  return {
    ok: true as const,
    user: context.user,
    membership: context.membership,
  };
}
