import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  marketingAudiences,
  marketingCampaigns,
  marketingContentItems,
  marketingContentVariants,
  marketingSocialAccounts,
} from "@/db/schema";

export async function marketingCampaignBelongsToBusiness(
  businessId: string,
  campaignId: string,
  executor: Pick<typeof db, "select"> = db,
) {
  const [row] = await executor
    .select({ id: marketingCampaigns.id })
    .from(marketingCampaigns)
    .where(
      and(
        eq(marketingCampaigns.id, campaignId),
        eq(marketingCampaigns.businessId, businessId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function marketingContentBelongsToBusiness(
  businessId: string,
  contentItemId: string,
  executor: Pick<typeof db, "select"> = db,
) {
  const [row] = await executor
    .select({
      id: marketingContentItems.id,
      campaignId: marketingContentItems.campaignId,
      approvalStatus: marketingContentItems.approvalStatus,
    })
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.id, contentItemId),
        eq(marketingContentItems.businessId, businessId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function marketingVariantBelongsToBusiness(
  businessId: string,
  variantId: string,
  executor: Pick<typeof db, "select"> = db,
) {
  const [row] = await executor
    .select({
      id: marketingContentVariants.id,
      contentItemId: marketingContentVariants.contentItemId,
      channel: marketingContentVariants.channel,
    })
    .from(marketingContentVariants)
    .where(
      and(
        eq(marketingContentVariants.id, variantId),
        eq(marketingContentVariants.businessId, businessId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function marketingAudienceBelongsToBusiness(
  businessId: string,
  audienceId: string,
) {
  const [row] = await db
    .select({ id: marketingAudiences.id })
    .from(marketingAudiences)
    .where(
      and(
        eq(marketingAudiences.id, audienceId),
        eq(marketingAudiences.businessId, businessId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function marketingSocialAccountBelongsToBusiness(
  businessId: string,
  socialAccountId: string,
  executor: Pick<typeof db, "select"> = db,
) {
  const [row] = await executor
    .select({ id: marketingSocialAccounts.id, provider: marketingSocialAccounts.provider })
    .from(marketingSocialAccounts)
    .where(
      and(
        eq(marketingSocialAccounts.id, socialAccountId),
        eq(marketingSocialAccounts.businessId, businessId),
      ),
    )
    .limit(1);

  return row ?? null;
}
