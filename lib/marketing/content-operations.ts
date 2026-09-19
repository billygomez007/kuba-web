import { and, desc, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  marketingApprovals,
  marketingAssets,
  marketingCampaigns,
  marketingContentItems,
  marketingContentVariants,
  marketingPublishJobs,
  marketingSocialAccounts,
} from "@/db/schema";

export async function getMarketingContentOperations(
  businessId: string,
  contentItemId: string,
) {
  const [content] = await db
    .select()
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.id, contentItemId),
        eq(marketingContentItems.businessId, businessId),
      ),
    )
    .limit(1);

  if (!content) {
    return null;
  }

  const [
    campaign,
    variants,
    approvals,
    publishJobs,
    campaignAssets,
    activity,
    socialAccounts,
  ] = await Promise.all([
    content.campaignId
      ? db
          .select()
          .from(marketingCampaigns)
          .where(
            and(
              eq(marketingCampaigns.id, content.campaignId),
              eq(marketingCampaigns.businessId, businessId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),

    db
      .select()
      .from(marketingContentVariants)
      .where(
        and(
          eq(marketingContentVariants.businessId, businessId),
          eq(marketingContentVariants.contentItemId, contentItemId),
        ),
      )
      .orderBy(desc(marketingContentVariants.updatedAt)),

    db
      .select()
      .from(marketingApprovals)
      .where(
        and(
          eq(marketingApprovals.businessId, businessId),
          eq(marketingApprovals.resourceType, "content"),
          eq(marketingApprovals.resourceId, contentItemId),
        ),
      )
      .orderBy(desc(marketingApprovals.updatedAt)),

    db
      .select()
      .from(marketingPublishJobs)
      .where(
        and(
          eq(marketingPublishJobs.businessId, businessId),
          eq(marketingPublishJobs.contentItemId, contentItemId),
        ),
      )
      .orderBy(desc(marketingPublishJobs.updatedAt)),

    content.campaignId
      ? db
          .select()
          .from(marketingAssets)
          .where(
            and(
              eq(marketingAssets.businessId, businessId),
              eq(marketingAssets.campaignId, content.campaignId),
            ),
          )
          .orderBy(desc(marketingAssets.updatedAt))
      : Promise.resolve([]),

    db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.businessId, businessId),
          like(auditLogs.action, "marketing.%"),
          or(
            and(
              eq(auditLogs.resource, "marketing_content"),
              eq(auditLogs.resourceId, contentItemId),
            ),
            and(
              eq(auditLogs.resource, "marketing_content_item"),
              eq(auditLogs.resourceId, contentItemId),
            ),
          ),
        ),
      )
      .orderBy(desc(auditLogs.createdAt)),

    db
      .select()
      .from(marketingSocialAccounts)
      .where(eq(marketingSocialAccounts.businessId, businessId))
      .orderBy(desc(marketingSocialAccounts.updatedAt)),
  ]);

  return {
    content,
    campaign,
    variants,
    approvals,
    publishJobs,
    assets: campaignAssets,
    activity,
    socialAccounts,
  };
}
