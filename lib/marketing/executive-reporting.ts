import {
  getMarketingAnalyticsOperations,
  type MarketingAnalyticsRange,
} from "@/lib/marketing/analytics-operations";

export async function getMarketingExecutiveReport(
  businessId: string,
  range: MarketingAnalyticsRange = { from: null, to: null },
) {
  const analytics = await getMarketingAnalyticsOperations(
    businessId,
    range,
  );

  const campaignRows = analytics.campaigns.map((entry) => ({
    campaignId: entry.campaign.id,
    campaignName: entry.campaign.name,
    status: entry.campaign.status,
    attributionEvents: entry.attributionCount,
    conversions: entry.conversionCount,
    persistedMetrics: entry.metrics.map((metric) => ({
      metric: metric.metric,
      value: metric.value,
      capturedAt: metric.capturedAt,
    })),
  }));

  const campaignsWithEvidence = campaignRows.filter(
    (campaign) =>
      campaign.attributionEvents > 0 ||
      campaign.persistedMetrics.length > 0,
  ).length;

  const channels = analytics.socialAccounts.map((account) => ({
    provider: account.provider,
    displayName: account.displayName,
    status: account.status,
  }));

  return {
    generatedAt: new Date(),
    range,
    summary: {
      campaigns: analytics.summary.campaigns,
      campaignsWithEvidence,
      attributionEvents: analytics.summary.attributionEvents,
      conversions: analytics.summary.conversions,
      attributedLeads: analytics.summary.attributedLeads,
      attributedCustomers: analytics.summary.attributedCustomers,
      attributedDeals: analytics.summary.attributedDeals,
      publishingJobs: analytics.summary.publishJobs,
      connectedAccounts: analytics.summary.connectedAccounts,
    },
    attributedValueByCurrency: analytics.currencyTotals,
    campaigns: campaignRows,
    channels,
    metricAvailability: analytics.metricAvailability,
    evidencePolicy: {
      persistedOnly: true,
      attributedValueIsRevenue: false,
      providerMetricsInferred: false,
      note:
        "This report uses persisted native Marketing records only. Attributed value is not presented as accounting revenue. Missing provider metrics are unavailable and are never inferred.",
    },
  };
}
