import { and, desc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  marketingApprovals,
  marketingAttributions,
  marketingAudiences,
  marketingAudienceRules,
  marketingCampaignChannels,
  marketingCampaigns,
  marketingContentItems,
  marketingContentVariants,
  marketingMetricSnapshots,
  marketingPublishJobs,
  marketingSocialAccounts,
} from "@/db/schema";

export async function getMarketingCampaignOperations(
  businessId: string,
  campaignId: string,
) {
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(
      and(
        eq(marketingCampaigns.businessId, businessId),
        eq(marketingCampaigns.id, campaignId),
      ),
    )
    .limit(1);

  if (!campaign) return null;

  const [
    channels,
    content,
    campaignApprovals,
    publishJobs,
    attributions,
    metrics,
    activity,
    socialAccounts,
  ] = await Promise.all([
    db
      .select()
      .from(marketingCampaignChannels)
      .where(
        and(
          eq(marketingCampaignChannels.businessId, businessId),
          eq(marketingCampaignChannels.campaignId, campaignId),
        ),
      )
      .orderBy(desc(marketingCampaignChannels.updatedAt)),

    db
      .select()
      .from(marketingContentItems)
      .where(
        and(
          eq(marketingContentItems.businessId, businessId),
          eq(marketingContentItems.campaignId, campaignId),
        ),
      )
      .orderBy(desc(marketingContentItems.updatedAt)),

    db
      .select()
      .from(marketingApprovals)
      .where(
        and(
          eq(marketingApprovals.businessId, businessId),
          eq(marketingApprovals.resourceType, "campaign"),
          eq(marketingApprovals.resourceId, campaignId),
        ),
      )
      .orderBy(desc(marketingApprovals.updatedAt)),

    db
      .select()
      .from(marketingPublishJobs)
      .where(
        and(
          eq(marketingPublishJobs.businessId, businessId),
          eq(marketingPublishJobs.campaignId, campaignId),
        ),
      )
      .orderBy(desc(marketingPublishJobs.updatedAt)),

    db
      .select()
      .from(marketingAttributions)
      .where(
        and(
          eq(marketingAttributions.businessId, businessId),
          eq(marketingAttributions.campaignId, campaignId),
        ),
      )
      .orderBy(desc(marketingAttributions.occurredAt)),

    db
      .select()
      .from(marketingMetricSnapshots)
      .where(
        and(
          eq(marketingMetricSnapshots.businessId, businessId),
          eq(marketingMetricSnapshots.campaignId, campaignId),
        ),
      )
      .orderBy(desc(marketingMetricSnapshots.capturedAt)),

    db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.businessId, businessId),
          eq(auditLogs.resourceId, campaignId),
          like(auditLogs.action, "marketing.%"),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),

    db
      .select()
      .from(marketingSocialAccounts)
      .where(eq(marketingSocialAccounts.businessId, businessId))
      .orderBy(desc(marketingSocialAccounts.updatedAt)),
  ]);

  const audience = campaign.targetAudienceId
    ? (
        await db
          .select()
          .from(marketingAudiences)
          .where(
            and(
              eq(marketingAudiences.businessId, businessId),
              eq(marketingAudiences.id, campaign.targetAudienceId),
            ),
          )
          .limit(1)
      )[0] ?? null
    : null;

  const audienceRules = audience
    ? await db
        .select()
        .from(marketingAudienceRules)
        .where(
          and(
            eq(marketingAudienceRules.businessId, businessId),
            eq(marketingAudienceRules.audienceId, audience.id),
          ),
        )
        .orderBy(marketingAudienceRules.position)
    : [];

  const contentIds = content.map((item) => item.id);

  const [variants, contentApprovals] =
    contentIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(marketingContentVariants)
            .where(
              and(
                eq(marketingContentVariants.businessId, businessId),
                inArray(marketingContentVariants.contentItemId, contentIds),
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
                inArray(marketingApprovals.resourceId, contentIds),
              ),
            )
            .orderBy(desc(marketingApprovals.updatedAt)),
        ]);

  const approvals = [...campaignApprovals, ...contentApprovals].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() -
      new Date(left.updatedAt).getTime(),
  );

  return {
    campaign,
    channels,
    audience,
    audienceRules,
    content,
    variants,
    approvals,
    publishJobs,
    attributions,
    metrics,
    activity,
    socialAccounts,
  };
}
