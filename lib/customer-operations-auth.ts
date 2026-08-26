import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability, type Capability } from "@/lib/billing/entitlements";

export async function getOperationsContext(permission: Permission, capability: Capability) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: "Unauthorized.", status: 401 as const };
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Business access denied.", status: 403 as const };
  if (!hasPermission(membership.role, membership.permissions, permission)) return { error: "Forbidden.", status: 403 as const };
  if (!hasCapability(await getBusinessEntitlements(membership.businessId), capability)) {
    return { error: "This Customer Operations capability requires an active plan.", status: 403 as const, upgradeRequired: true, code: "FEATURE_NOT_ENTITLED" };
  }
  return { session, membership } as const;
}
