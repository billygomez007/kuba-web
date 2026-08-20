import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";

export const DASHBOARD_ROUTE_PERMISSIONS: Record<
  string,
  Permission
> = {
  "/dashboard/workforce":
    PERMISSIONS.WORKFORCE_VIEW,

  "/dashboard/customers":
    PERMISSIONS.CUSTOMERS_VIEW,

  "/dashboard/messaging":
    PERMISSIONS.MESSAGING_VIEW,

  "/dashboard/knowledge":
    PERMISSIONS.KNOWLEDGE_VIEW,

  "/dashboard/automations":
    PERMISSIONS.AUTOMATIONS_VIEW,

  "/dashboard/tasks":
    PERMISSIONS.TASKS_VIEW,

  "/dashboard/analytics":
    PERMISSIONS.ANALYTICS_VIEW,

  "/dashboard/integrations":
    PERMISSIONS.INTEGRATIONS_VIEW,

  "/dashboard/settings/team":
    PERMISSIONS.USERS_VIEW,

  "/dashboard/settings":
    PERMISSIONS.SETTINGS_VIEW,
};

export async function canAccessDashboardRoute(
  userId: string,
  pathname: string,
) {
  const membership =
    await getBusinessMembership(userId);

  if (!membership) {
    return false;
  }

  const matchedRoute =
    Object.keys(DASHBOARD_ROUTE_PERMISSIONS)
      .sort((a, b) => b.length - a.length)
      .find((route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`),
      );

  if (!matchedRoute) {
    return true;
  }

  return hasPermission(
    membership.role,
    membership.permissions,
    DASHBOARD_ROUTE_PERMISSIONS[matchedRoute],
  );
}
