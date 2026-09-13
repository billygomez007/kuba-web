import { redirect } from "next/navigation";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { requireBusinessMembership } from "@/lib/auth/tenant";

import WebsiteChatClient from "./WebsiteChatClient";

export default async function WebsiteChatPage() {
  const { user, membership } = await requireBusinessMembership();

  if (!user) {
    redirect(
      "/login?callbackUrl=%2Fdashboard%2Fintegrations%2Fwebsite-chat",
    );
  }

  // No membership here means either a genuinely new account (no business
  // yet) or an unresolved selection among several real memberships —
  // requireBusinessMembership()/getCurrentMembership() already honor the
  // superkuba_business_id cookie via selectBusinessMembership(), so a
  // multi-business user with a real current selection (e.g. Kora OS)
  // resolves correctly here instead of requiring exactly one membership
  // total, which previously sent every multi-business account to
  // /dashboard regardless of which business was actually selected.
  if (!membership) {
    redirect("/onboarding");
  }

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_VIEW,
    )
  ) {
    redirect("/dashboard");
  }

  return <WebsiteChatClient />;
}
