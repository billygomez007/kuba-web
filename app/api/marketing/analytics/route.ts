import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketingApprovals, marketingAudiences, marketingCampaigns, marketingContentItems, marketingPublishJobs, marketingSocialAccounts } from "@/db/schema";
import { requireMarketingAccess } from "@/lib/marketing/context";

export async function GET() {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const businessId = access.businessId;
  // Drizzle's SQLite table generic is invariant; the six tables share the same businessId contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: any) => Number((await db.select({ count: sql<number>`count(*)` }).from(table).where(eq(table.businessId, businessId)))[0]?.count ?? 0);
  const [campaigns, content, approvals, jobs, audiences, social] = await Promise.all([count(marketingCampaigns), count(marketingContentItems), count(marketingApprovals), count(marketingPublishJobs), count(marketingAudiences), count(marketingSocialAccounts)]);
  return NextResponse.json({ native: { campaigns, content, approvals, publishJobs: jobs, audiences, socialAccounts: social }, external: { status: "not_connected", metrics: ["ctr", "cpc", "cpm", "roas", "reach", "impressions", "likes", "shares", "comments", "videoViews"] } });
}
