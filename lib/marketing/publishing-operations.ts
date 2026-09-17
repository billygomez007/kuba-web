import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  aiEmployees, businessUsers, marketingApprovals, marketingCampaigns,
  marketingContentItems, marketingContentVariants, marketingPublishJobs,
  marketingSocialAccounts, users,
} from "@/db/schema";
import { mergeScheduledUnits } from "@/lib/marketing/overview";

async function resources(businessId: string) {
  const [contents, campaigns] = await Promise.all([
    db.select({ id: marketingContentItems.id, title: marketingContentItems.title, campaignId: marketingContentItems.campaignId }).from(marketingContentItems).where(eq(marketingContentItems.businessId, businessId)),
    db.select({ id: marketingCampaigns.id, name: marketingCampaigns.name }).from(marketingCampaigns).where(eq(marketingCampaigns.businessId, businessId)),
  ]);
  return { contents: new Map(contents.map(row => [row.id, row])), campaigns: new Map(campaigns.map(row => [row.id, row])) };
}

export async function getMarketingApprovalCenter(businessId: string) {
  const [approvals, refs, members, employees] = await Promise.all([
    db.select().from(marketingApprovals).where(eq(marketingApprovals.businessId, businessId)).orderBy(desc(marketingApprovals.updatedAt)),
    resources(businessId),
    db.select({ id: users.id, name: users.name }).from(users).innerJoin(businessUsers, and(eq(businessUsers.userId, users.id), eq(businessUsers.businessId, businessId))),
    db.select({ id: aiEmployees.id, name: aiEmployees.name }).from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
  ]);
  const names = new Map(members.map(row => [row.id, row.name]));
  const employeeNames = new Map(employees.map(row => [row.id, row.name]));
  return approvals.map(row => {
    const resource = row.resourceType === "content" ? refs.contents.get(row.resourceId) : row.resourceType === "campaign" ? refs.campaigns.get(row.resourceId) : null;
    return {
      ...row,
      resourceName: resource ? ("title" in resource ? resource.title : resource.name) : null,
      resourceHref: resource ? `/dashboard/marketing/${row.resourceType === "content" ? "content" : "campaigns"}/${encodeURIComponent(resource.id)}` : null,
      requesterName: row.requestedByUserId ? names.get(row.requestedByUserId) ?? null : row.requestedByEmployeeId ? employeeNames.get(row.requestedByEmployeeId) ?? null : null,
      reviewerName: row.reviewedByUserId ? names.get(row.reviewedByUserId) ?? null : null,
    };
  });
}

export async function getMarketingPublishingOperations(businessId: string) {
  const [jobs, refs, variants, accounts] = await Promise.all([
    db.select().from(marketingPublishJobs).where(eq(marketingPublishJobs.businessId, businessId)).orderBy(desc(marketingPublishJobs.updatedAt)),
    resources(businessId),
    db.select({ id: marketingContentVariants.id, headline: marketingContentVariants.headline, contentItemId: marketingContentVariants.contentItemId, channel: marketingContentVariants.channel }).from(marketingContentVariants).where(eq(marketingContentVariants.businessId, businessId)),
    getMarketingChannelAccounts(businessId),
  ]);
  const variantMap = new Map(variants.map(row => [row.id, row]));
  const accountMap = new Map(accounts.map(row => [row.id, row]));
  return jobs.map(job => {
    const variant = job.contentVariantId ? variantMap.get(job.contentVariantId) : null;
    return {
      ...job,
      content: refs.contents.get(job.contentItemId) ?? null,
      campaign: job.campaignId ? refs.campaigns.get(job.campaignId) ?? null : null,
      variant: variant?.contentItemId === job.contentItemId && variant.channel === job.channel ? variant : null,
      socialAccount: job.socialAccountId && accountMap.get(job.socialAccountId)?.provider === job.channel ? accountMap.get(job.socialAccountId) ?? null : null,
    };
  });
}

export const MARKETING_SOCIAL_PROVIDERS = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube", "telegram"] as const;
export function getMarketingChannelAccounts(businessId: string) {
  // Explicit projection: connection metadata is never needed by the readiness UI.
  return db.select({
    id: marketingSocialAccounts.id, provider: marketingSocialAccounts.provider,
    displayName: marketingSocialAccounts.displayName, handle: marketingSocialAccounts.handle,
    status: marketingSocialAccounts.status, connectedAt: marketingSocialAccounts.connectedAt,
    expiresAt: marketingSocialAccounts.expiresAt, updatedAt: marketingSocialAccounts.updatedAt,
  }).from(marketingSocialAccounts).where(eq(marketingSocialAccounts.businessId, businessId)).orderBy(desc(marketingSocialAccounts.updatedAt));
}

export async function getMarketingCalendar(businessId: string, from: Date, to: Date) {
  const [variants, jobs, refs] = await Promise.all([
    db.select().from(marketingContentVariants).where(eq(marketingContentVariants.businessId, businessId)),
    getMarketingPublishingOperations(businessId),
    resources(businessId),
  ]);
  // Use the same canonical units as the overview, before filtering the range.
  const units = mergeScheduledUnits(
    variants.filter(row => row.scheduledAt),
    jobs.filter(row => row.scheduledAt),
  );
  const jobMap = new Map(jobs.map(job => [`job:${job.id}`, job]));
  const entries = units.filter(unit => unit.scheduledAt >= from && unit.scheduledAt <= to)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.unitId.localeCompare(b.unitId))
    .map(unit => {
      const content = refs.contents.get(unit.contentItemId) ?? null;
      const campaignId = unit.campaignId ?? content?.campaignId;
      const job = jobMap.get(unit.unitId);
      return { ...unit, content, campaign: campaignId ? refs.campaigns.get(campaignId) ?? null : null,
        failureCode: job?.failureCode ?? null, failureMessageSafe: job?.failureMessageSafe ?? null,
        publishedAt: job?.publishedAt ?? null, providerPostId: job?.providerPostId ?? null,
      };
    });
  // Retain the original API collections for existing consumers.
  return { entries, variants: variants.filter(row => row.scheduledAt && row.scheduledAt >= from && row.scheduledAt <= to), jobs: jobs.filter(row => row.scheduledAt && row.scheduledAt >= from && row.scheduledAt <= to) };
}

export function marketingChannelReadiness(accounts: Awaited<ReturnType<typeof getMarketingChannelAccounts>>, now = new Date()) {
  return MARKETING_SOCIAL_PROVIDERS.map(provider => ({
    provider,
    accounts: accounts.filter(account => account.provider === provider).map(account => ({
      ...account,
      readinessState: account.status === "connected" && account.expiresAt && account.expiresAt <= now ? "expired" : account.status,
    })),
    execution: "blocked" as const,
    code: "PUBLISHING_ADAPTER_UNAVAILABLE" as const,
  }));
}
