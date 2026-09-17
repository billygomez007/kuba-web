import { and, desc, eq, inArray, isNotNull, like } from "drizzle-orm";
import { db } from "@/db";
import {
  aiEmployees,
  auditLogs,
  marketingApprovals,
  marketingAttributions,
  marketingAudiences,
  marketingCampaigns,
  marketingContentItems,
  marketingContentVariants,
  marketingPublishJobs,
  marketingSocialAccounts,
  users,
} from "@/db/schema";

// Only "active" reflects a campaign that is genuinely running right now.
// "scheduled" and "paused" are real lifecycle states too, but they are
// already surfaced as their own buckets in campaign activity, so folding
// them into this count would double-represent them as both "active" and
// their real status.
const ACTIVE_CAMPAIGN_STATUSES: readonly string[] = ["active"];

const CAMPAIGN_LIFECYCLE_ORDER = ["draft", "planned", "pending_approval", "approved", "scheduled", "active", "paused", "completed", "cancelled"] as const;

const SOCIAL_PROVIDERS = [
  { provider: "facebook", label: "Facebook" },
  { provider: "instagram", label: "Instagram" },
  { provider: "linkedin", label: "LinkedIn" },
  { provider: "x", label: "X" },
  { provider: "tiktok", label: "TikTok" },
  { provider: "youtube", label: "YouTube" },
  { provider: "telegram", label: "Telegram" },
] as const;

const CHANNEL_STATES = ["connected", "not_connected", "needs_attention", "expired", "disabled"] as const;
export type ChannelState = (typeof CHANNEL_STATES)[number];

function resolveChannelState(status: string | null | undefined): ChannelState {
  if (status && (CHANNEL_STATES as readonly string[]).includes(status)) return status as ChannelState;
  return "not_connected";
}

type ScheduledUnit = {
  unitId: string;
  kind: "content_variant" | "publish_job";
  contentItemId: string;
  campaignId: string | null;
  channel: string;
  status: string;
  scheduledAt: Date;
};

/**
 * A content variant and the publish job that carries it are the same
 * real-world scheduled unit, not two. When a job references a variant,
 * the job (the canonical publish mechanism) represents that unit; the
 * variant is only counted on its own when no job has been created for it
 * yet. This is the one dedup rule shared by the "Scheduled Content"
 * summary count and the "Upcoming Activities" feed, so the two can never
 * disagree about how many scheduled things exist.
 */
export function mergeScheduledUnits(
  // scheduledAt is typed Date | null to match the underlying column, but
  // every caller has already filtered to isNotNull(scheduledAt) at the
  // query level — the ! assertions below reflect that real invariant.
  variants: { id: string; contentItemId: string; channel: string; status: string; scheduledAt: Date | null }[],
  jobs: { id: string; contentItemId: string; contentVariantId: string | null; campaignId: string | null; channel: string; status: string; scheduledAt: Date | null }[],
): ScheduledUnit[] {
  const jobByVariantId = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) if (job.contentVariantId) jobByVariantId.set(job.contentVariantId, job);

  const units: ScheduledUnit[] = [];
  for (const variant of variants) {
    if (jobByVariantId.has(variant.id)) continue;
    units.push({ unitId: `variant:${variant.id}`, kind: "content_variant", contentItemId: variant.contentItemId, campaignId: null, channel: variant.channel, status: variant.status, scheduledAt: variant.scheduledAt! });
  }
  for (const job of jobs) {
    units.push({ unitId: `job:${job.id}`, kind: "publish_job", contentItemId: job.contentItemId, campaignId: job.campaignId, channel: job.channel, status: job.status, scheduledAt: job.scheduledAt! });
  }
  return units;
}

export type MarketingUpcomingActivity = {
  id: string;
  type: "campaign_start" | "campaign_end" | "content_scheduled" | "publish_job";
  at: Date;
  title: string;
  channel: string | null;
  status: string;
  campaignId: string | null;
};

export type MarketingOverviewResult = {
  summary: {
    activeCampaigns: number;
    contentPieces: number;
    scheduledContent: number;
    pendingApprovals: number;
    leadsAttributed: number;
  };
  campaignActivity: { status: string; count: number }[];
  upcoming: MarketingUpcomingActivity[];
  recentCampaigns: { id: string; name: string; objective: string; status: string; startAt: Date | null; endAt: Date | null }[];
  recentContent: { id: string; title: string; contentType: string; status: string; approvalStatus: string; updatedAt: Date }[];
  channelReadiness: { provider: string; label: string; state: ChannelState; displayName: string | null; handle: string | null; connectedAt: Date | null; expiresAt: Date | null }[];
  audienceOverview: {
    total: number;
    latest: { id: string; name: string; status: string; estimatedCount: number | null; updatedAt: Date }[];
  };
  approvalQueue: { id: string; resourceType: string; resourceId: string; resourceName: string | null; requesterName: string | null; createdAt: Date; status: string }[];
  recentActivity: { id: string; action: string; description: string | null; createdAt: Date }[];
};

const RECENT_LIMIT = 5;
const UPCOMING_LIMIT = 10;
const ACTIVITY_LIMIT = 10;

export async function getMarketingOverview(businessId: string): Promise<MarketingOverviewResult> {
  const now = new Date();

  const [campaigns, contentItems, scheduledVariants, scheduledJobs, pendingApprovals, audiences, socialAccounts, attributionLeadRows, activityEvents] = await Promise.all([
    db.select().from(marketingCampaigns).where(eq(marketingCampaigns.businessId, businessId)).orderBy(desc(marketingCampaigns.updatedAt)),
    db.select().from(marketingContentItems).where(eq(marketingContentItems.businessId, businessId)).orderBy(desc(marketingContentItems.updatedAt)),
    db.select().from(marketingContentVariants).where(and(eq(marketingContentVariants.businessId, businessId), isNotNull(marketingContentVariants.scheduledAt))),
    db.select().from(marketingPublishJobs).where(and(eq(marketingPublishJobs.businessId, businessId), isNotNull(marketingPublishJobs.scheduledAt))),
    db.select().from(marketingApprovals).where(and(eq(marketingApprovals.businessId, businessId), eq(marketingApprovals.status, "pending"))).orderBy(desc(marketingApprovals.createdAt)),
    db.select().from(marketingAudiences).where(eq(marketingAudiences.businessId, businessId)).orderBy(desc(marketingAudiences.updatedAt)),
    db.select().from(marketingSocialAccounts).where(eq(marketingSocialAccounts.businessId, businessId)).orderBy(desc(marketingSocialAccounts.updatedAt)),
    db.select({ leadId: marketingAttributions.leadId }).from(marketingAttributions).where(and(eq(marketingAttributions.businessId, businessId), isNotNull(marketingAttributions.leadId))),
    db.select().from(auditLogs).where(and(eq(auditLogs.businessId, businessId), like(auditLogs.action, "marketing.%"))).orderBy(desc(auditLogs.createdAt)).limit(ACTIVITY_LIMIT),
  ]);

  const contentItemById = new Map(contentItems.map((item) => [item.id, item]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  // Summary: active campaigns
  const activeCampaigns = campaigns.filter((campaign) => ACTIVE_CAMPAIGN_STATUSES.includes(campaign.status)).length;

  // Campaign activity: only statuses that actually occur, in lifecycle order
  const statusCounts = new Map<string, number>();
  for (const campaign of campaigns) statusCounts.set(campaign.status, (statusCounts.get(campaign.status) ?? 0) + 1);
  const campaignActivity: { status: string; count: number }[] = CAMPAIGN_LIFECYCLE_ORDER.filter((status) => statusCounts.has(status)).map((status) => ({ status, count: statusCounts.get(status)! }));
  for (const [status, statusCount] of statusCounts) if (!(CAMPAIGN_LIFECYCLE_ORDER as readonly string[]).includes(status)) campaignActivity.push({ status, count: statusCount });

  // Scheduled content (deduplicated) + upcoming scheduled entries
  const scheduledUnits = mergeScheduledUnits(scheduledVariants, scheduledJobs);
  const scheduledContent = scheduledUnits.length;

  const leadsAttributed = new Set(attributionLeadRows.map((row) => row.leadId).filter((leadId): leadId is string => Boolean(leadId))).size;

  const pendingApprovalsCount = pendingApprovals.length;

  const upcoming: MarketingUpcomingActivity[] = [];
  for (const campaign of campaigns) {
    if (campaign.startAt && campaign.startAt >= now) upcoming.push({ id: `campaign-start:${campaign.id}`, type: "campaign_start", at: campaign.startAt, title: campaign.name, channel: null, status: campaign.status, campaignId: campaign.id });
    if (campaign.endAt && campaign.endAt >= now) upcoming.push({ id: `campaign-end:${campaign.id}`, type: "campaign_end", at: campaign.endAt, title: campaign.name, channel: null, status: campaign.status, campaignId: campaign.id });
  }
  for (const unit of scheduledUnits) {
    if (unit.scheduledAt < now) continue;
    const contentItem = contentItemById.get(unit.contentItemId);
    upcoming.push({
      id: unit.unitId,
      type: unit.kind === "content_variant" ? "content_scheduled" : "publish_job",
      at: unit.scheduledAt,
      title: contentItem?.title ?? "Untitled content",
      channel: unit.channel,
      status: unit.status,
      campaignId: unit.campaignId ?? contentItem?.campaignId ?? null,
    });
  }
  upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
  const boundedUpcoming = upcoming.slice(0, UPCOMING_LIMIT);

  const recentCampaigns = campaigns.slice(0, RECENT_LIMIT).map((campaign) => ({ id: campaign.id, name: campaign.name, objective: campaign.objective, status: campaign.status, startAt: campaign.startAt, endAt: campaign.endAt }));

  const recentContent = contentItems.slice(0, RECENT_LIMIT).map((item) => ({ id: item.id, title: item.title, contentType: item.contentType, status: item.status, approvalStatus: item.approvalStatus, updatedAt: item.updatedAt }));

  const channelReadiness = SOCIAL_PROVIDERS.map(({ provider, label }) => {
    const account = socialAccounts.find((row) => row.provider === provider) ?? null;
    return {
      provider,
      label,
      state: resolveChannelState(account?.status),
      displayName: account?.displayName ?? null,
      handle: account?.handle ?? null,
      connectedAt: account?.connectedAt ?? null,
      expiresAt: account?.expiresAt ?? null,
    };
  });

  const audienceOverview = {
    total: audiences.length,
    latest: audiences.slice(0, RECENT_LIMIT).map((audience) => ({ id: audience.id, name: audience.name, status: audience.status, estimatedCount: audience.estimatedCount, updatedAt: audience.updatedAt })),
  };

  const approvalPreviewRows = pendingApprovals.slice(0, RECENT_LIMIT);
  const requesterUserIds = [...new Set(approvalPreviewRows.map((row) => row.requestedByUserId).filter((id): id is string => Boolean(id)))];
  const requesterEmployeeIds = [...new Set(approvalPreviewRows.map((row) => row.requestedByEmployeeId).filter((id): id is string => Boolean(id)))];
  const [requesterUsers, requesterEmployees] = await Promise.all([
    requesterUserIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, requesterUserIds)) : Promise.resolve([]),
    requesterEmployeeIds.length ? db.select({ id: aiEmployees.id, name: aiEmployees.name }).from(aiEmployees).where(and(eq(aiEmployees.businessId, businessId), inArray(aiEmployees.id, requesterEmployeeIds))) : Promise.resolve([]),
  ]);
  const userNameById = new Map(requesterUsers.map((row) => [row.id, row.name]));
  const employeeNameById = new Map(requesterEmployees.map((row) => [row.id, row.name]));

  const approvalQueue = approvalPreviewRows.map((approval) => {
    const resourceName = approval.resourceType === "marketing_campaign" ? campaignById.get(approval.resourceId)?.name ?? null : approval.resourceType === "marketing_content_item" ? contentItemById.get(approval.resourceId)?.title ?? null : null;
    const requesterName = (approval.requestedByUserId && userNameById.get(approval.requestedByUserId)) || (approval.requestedByEmployeeId && employeeNameById.get(approval.requestedByEmployeeId)) || null;
    return { id: approval.id, resourceType: approval.resourceType, resourceId: approval.resourceId, resourceName, requesterName, createdAt: approval.createdAt, status: approval.status };
  });

  const recentActivity = activityEvents.map((event) => ({ id: event.id, action: event.action, description: event.description, createdAt: event.createdAt }));

  return {
    summary: { activeCampaigns, contentPieces: contentItems.length, scheduledContent, pendingApprovals: pendingApprovalsCount, leadsAttributed },
    campaignActivity,
    upcoming: boundedUpcoming,
    recentCampaigns,
    recentContent,
    channelReadiness,
    audienceOverview,
    approvalQueue,
    recentActivity,
  };
}
