import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import VoiceOverviewClient from "./VoiceOverviewClient";

export default async function VoiceOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?callbackUrl=%2Fdashboard%2Fvoice");

  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");

  const business = (await db.select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, membership.businessId))
    .limit(1))[0];
  if (!business) redirect("/onboarding");

  const entitlements = await getBusinessEntitlements(membership.businessId);
  if (!entitlements.capabilities.includes("ai_workforce.voice")) redirect("/dashboard");

  return <VoiceOverviewClient businessName={business.name} />;
}
