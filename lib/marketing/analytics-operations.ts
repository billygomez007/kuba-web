import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  marketingAttributions,
  marketingCampaigns,
  marketingMetricSnapshots,
  marketingPublishJobs,
  marketingSocialAccounts,
} from "@/db/schema";

export type MarketingAnalyticsRange = {
  from: Date | null;
  to: Date | null;
};

function rangeConditions<T>(
  column: T,
  range: MarketingAnalyticsRange,
) {
  const conditions = [];

  if (range.from) conditions.push(gte(column as never, range.from));
  if (range.to) conditions.push(lte(column as never, range.to));

  return conditions;
}

export async function getMarketingAnalyticsOperations(
  businessId: string,
  range: MarketingAnalyticsRange = { from: null, to: null },
) {
  const attributionConditions = [
    eq(marketingAttributions.businessId, businessId),
    ...rangeConditions(marketingAttributions.occurredAt, range),
  ];

  const metricConditions = [
    eq(marketingMetricSnapshots.businessId, businessId),
    ...rangeConditions(marketingMetricSnapshots.capturedAt, range),
  ];

  const publishConditions = [
    eq(marketingPublishJobs.businessId, businessId),
    ...rangeConditions(marketingPublishJobs.updatedAt, range),
  ];

  const [
    campaigns,
    attributions,
    metricSnapshots,
    publishJobs,
    socialAccounts,
  ] = await Promise.all([
    db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.businessId, businessId))
      .orderBy(desc(marketingCampaigns.updatedAt)),

    db
      .select()
      .from(marketingAttributions)
      .where(and(...attributionConditions))
      .orderBy(desc(marketingAttributions.occurredAt)),

    db
      .select()
      .from(marketingMetricSnapshots)
      .where(and(...metricConditions))
      .orderBy(asc(marketingMetricSnapshots.capturedAt)),

    db
      .select()
      .from(marketingPublishJobs)
      .where(and(...publishConditions))
      .orderBy(desc(marketingPublishJobs.updatedAt)),

    db
      .select({
        id: marketingSocialAccounts.id,
        provider: marketingSocialAccounts.provider,
        displayName: marketingSocialAccounts.displayName,
        status: marketingSocialAccounts.status,
      })
      .from(marketingSocialAccounts)
      .where(eq(marketingSocialAccounts.businessId, businessId))
      .orderBy(desc(marketingSocialAccounts.updatedAt)),
  ]);

  const campaignById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign]),
  );

  const attributionEvents = attributions.map((attribution) => ({
    ...attribution,
    campaignName:
      campaignById.get(attribution.campaignId)?.name ?? null,
  }));

  const attributedLeadIds = new Set(
    attributions
      .map((attribution) => attribution.leadId)
      .filter((id): id is string => Boolean(id)),
  );

  const attributedCustomerIds = new Set(
    attributions
      .map((attribution) => attribution.customerId)
      .filter((id): id is string => Boolean(id)),
  );

  const attributedDealIds = new Set(
    attributions
      .map((attribution) => attribution.dealId)
      .filter((id): id is string => Boolean(id)),
  );

  const conversionEvents = attributions.filter(
    (attribution) => attribution.eventType === "conversion",
  );

  const monetaryAttributions = attributions.filter(
    (attribution) =>
      typeof attribution.value === "number" &&
      attribution.currency,
  );

  const currencyTotals = monetaryAttributions.reduce<
    Record<string, number>
  >((totals, attribution) => {
    const currency = attribution.currency as string;
    totals[currency] =
      (totals[currency] ?? 0) + Number(attribution.value ?? 0);
    return totals;
  }, {});

  const campaignPerformance = campaigns.map((campaign) => {
    const campaignAttributions = attributions.filter(
      (attribution) => attribution.campaignId === campaign.id,
    );

    const campaignMetrics = metricSnapshots.filter(
      (metric) => metric.campaignId === campaign.id,
    );

    return {
      campaign,
      attributionCount: campaignAttributions.length,
      conversionCount: campaignAttributions.filter(
        (attribution) => attribution.eventType === "conversion",
      ).length,
      metrics: campaignMetrics,
    };
  });

  const metricNames = Array.from(
    new Set(metricSnapshots.map((snapshot) => snapshot.metric)),
  ).sort();

  return {
    summary: {
      campaigns: campaigns.length,
      attributionEvents: attributions.length,
      conversions: conversionEvents.length,
      attributedLeads: attributedLeadIds.size,
      attributedCustomers: attributedCustomerIds.size,
      attributedDeals: attributedDealIds.size,
      publishJobs: publishJobs.length,
      connectedAccounts: socialAccounts.filter(
        (account) => account.status === "connected",
      ).length,
    },

    currencyTotals,

    metricAvailability: {
      persistedMetrics: metricNames,
      providerMetricsUnavailable:
        metricNames.length === 0,
      note:
        "Only persisted Marketing metric snapshots are reported. Missing provider metrics are never inferred or fabricated.",
    },

    campaigns: campaignPerformance,
    attributions: attributionEvents,
    metrics: metricSnapshots,
    publishJobs,
    socialAccounts,
  };
}
