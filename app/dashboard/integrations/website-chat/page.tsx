import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

import WebsiteChatClient from "./WebsiteChatClient";

export default async function WebsiteChatPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(
      "/login?callbackUrl=%2Fdashboard%2Fintegrations%2Fwebsite-chat",
    );
  }

  const membership = await getBusinessMembership(
    session.user.id,
  );

  if (
    !membership ||
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
