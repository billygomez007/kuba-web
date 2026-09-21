import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  auditLogs,
  integrations,
  marketingContentVariants,
  marketingPublishJobs,
  marketingSocialAccounts,
} from "@/db/schema";
import { MARKETING_CHANNELS, requireMarketingAccess } from "@/lib/marketing/context";
import { getMarketingPublishingOperations } from "@/lib/marketing/publishing-operations";
import { parseMarketingDate } from "@/lib/marketing/publishing-policy";
import {
  createPostizScheduledPost,
  decryptPostizCredential,
  POSTIZ_PROVIDER,
} from "@/lib/integrations/postiz/client";
import { and, eq } from "drizzle-orm";
import {
  marketingCampaignBelongsToBusiness,
  marketingContentBelongsToBusiness,
  marketingSocialAccountBelongsToBusiness,
  marketingVariantBelongsToBusiness,
} from "@/lib/marketing/ownership";

export async function GET() {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ jobs: await getMarketingPublishingOperations(access.businessId) });
}

export async function POST(request: Request) {
  const access = await requireMarketingAccess("manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => null);
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  if (typeof body?.contentItemId !== "string" || !body.contentItemId || typeof body?.channel !== "string") return fail("contentItemId and channel are required.");
  if (!(MARKETING_CHANNELS as readonly string[]).includes(body.channel)) return fail("Unsupported channel.");
  for (const key of ["campaignId", "contentVariantId", "socialAccountId", "idempotencyKey"]) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== "string" || !body[key].trim())) return fail(`${key} must be a non-empty string.`);
  }
  const scheduledAt = body.scheduledAt === undefined || body.scheduledAt === null ? null : parseMarketingDate(body.scheduledAt);
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && !scheduledAt) return fail("Invalid scheduledAt. Use an ISO date or timestamp with timezone.");

  // Validate relationships and approval in the same write transaction as the job and audit.
  return db.transaction(async (tx) => {
    const content = await marketingContentBelongsToBusiness(access.businessId, body.contentItemId, tx);
    if (!content) return fail("Content does not belong to this business.", 403);
    if (content.approvalStatus !== "approved") return fail("Content must be approved before creating a publish job.", 409);
    const campaignId = body.campaignId ?? content.campaignId ?? null;
    if (campaignId && !(await marketingCampaignBelongsToBusiness(access.businessId, campaignId, tx))) return fail("Campaign does not belong to this business.", 403);
    if (campaignId && content.campaignId !== campaignId) return fail("Content is not assigned to this campaign.", 409);

    const contentVariantId = body.contentVariantId ?? null;
    if (contentVariantId) {
      const variant = await marketingVariantBelongsToBusiness(access.businessId, contentVariantId, tx);
      if (!variant) return fail("Content variant does not belong to this business.", 403);
      if (variant.contentItemId !== body.contentItemId) return fail("Content variant does not belong to this content item.", 409);
      if (variant.channel !== body.channel) return fail("Content variant channel does not match the requested channel.", 409);
    }
    const socialAccountId = body.socialAccountId ?? null;
    if (socialAccountId) {
      const account = await marketingSocialAccountBelongsToBusiness(access.businessId, socialAccountId, tx);
      if (!account) return fail("Social account does not belong to this business.", 403);
      if (account.provider !== body.channel) return fail("Social account provider does not match the requested channel.", 409);
    }

    const now = new Date();

    let postizIntegrationId: string | null = null;
    let postizAccessToken: string | null = null;
    let postContent: string | null = null;

    if (socialAccountId) {
      const [account] = await tx
        .select({
          externalAccountId: marketingSocialAccounts.externalAccountId,
          status: marketingSocialAccounts.status,
          accountType: marketingSocialAccounts.accountType,
        })
        .from(marketingSocialAccounts)
        .where(
          and(
            eq(marketingSocialAccounts.id, socialAccountId),
            eq(marketingSocialAccounts.businessId, access.businessId),
          ),
        )
        .limit(1);

      if (
        !account ||
        account.status !== "connected" ||
        account.accountType !== "postiz" ||
        !account.externalAccountId
      ) {
        return fail(
          "Selected social account is not connected through Postiz.",
          409,
        );
      }

      postizIntegrationId = account.externalAccountId;

      const [integration] = await tx
        .select({
          credentialsEncrypted: integrations.credentialsEncrypted,
          status: integrations.status,
        })
        .from(integrations)
        .where(
          and(
            eq(integrations.businessId, access.businessId),
            eq(integrations.provider, POSTIZ_PROVIDER),
          ),
        )
        .limit(1);

      if (
        !integration ||
        integration.status !== "active" ||
        !integration.credentialsEncrypted
      ) {
        return fail(
          "Postiz is not connected for this business.",
          409,
        );
      }

      postizAccessToken = decryptPostizCredential(
        integration.credentialsEncrypted,
      );
    }

    if (contentVariantId) {
      const [variant] = await tx
        .select({
          text: marketingContentVariants.text,
          headline: marketingContentVariants.headline,
        })
        .from(marketingContentVariants)
        .where(
          and(
            eq(marketingContentVariants.id, contentVariantId),
            eq(marketingContentVariants.businessId, access.businessId),
          ),
        )
        .limit(1);

      if (variant) {
        postContent = [variant.headline, variant.text]
          .filter(Boolean)
          .join("\n\n")
          .trim();
      }
    }

    if (!postContent) {
      return fail(
        "A channel-specific content variant is required before publishing.",
        409,
      );
    }

    const effectiveScheduledAt =
      scheduledAt && scheduledAt.getTime() > Date.now()
        ? scheduledAt
        : new Date(Date.now() + 30_000);

    const job = {
      id: randomUUID(),
      businessId: access.businessId,
      campaignId,
      contentItemId: body.contentItemId,
      contentVariantId,
      socialAccountId,
      channel: body.channel,
      scheduledAt: effectiveScheduledAt,
      status: "queued",
      attemptCount: 0,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
      providerPostId: null,
      publishedAt: null,
      failedAt: null,
      failureCode: null,
      failureMessageSafe: null,
      metadata: JSON.stringify({
        provider: "postiz",
        requestedScheduledAt: scheduledAt?.toISOString() ?? null,
      }),
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await tx.insert(marketingPublishJobs).values(job).onConflictDoNothing({
      target: [marketingPublishJobs.businessId, marketingPublishJobs.idempotencyKey],
    }).returning({ id: marketingPublishJobs.id });
    if (!inserted.length) return NextResponse.json({ error: "A publish job with this idempotency key already exists.", code: "DUPLICATE_IDEMPOTENCY_KEY" }, { status: 409 });
    if (!postizAccessToken || !postizIntegrationId) {
      return fail(
        "A connected Postiz social account is required for publishing.",
        409,
      );
    }

    try {
      const postiz = await createPostizScheduledPost({
        accessToken: postizAccessToken,
        integrationId: postizIntegrationId,
        provider: body.channel,
        content: postContent,
        scheduledAt: effectiveScheduledAt,
      });

      await tx
        .update(marketingPublishJobs)
        .set({
          status: "scheduled",
          attemptCount: 1,
          providerPostId: postiz.id,
          failureCode: null,
          failureMessageSafe: null,
          metadata: JSON.stringify({
            provider: "postiz",
            postizResponseReceived: true,
          }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(marketingPublishJobs.id, job.id),
            eq(marketingPublishJobs.businessId, access.businessId),
          ),
        );

      await tx.insert(auditLogs).values({
        id: randomUUID(),
        businessId: access.businessId,
        userId: access.userId,
        action: "marketing.publish_job.scheduled",
        resource: "marketing_publish_job",
        resourceId: job.id,
        description: "Marketing publish job sent to Postiz.",
        metadata: JSON.stringify({
          contentItemId: content.id,
          channel: job.channel,
          scheduledAt: effectiveScheduledAt,
          provider: "postiz",
          providerPostId: postiz.id,
        }),
        createdAt: now,
      });

      return NextResponse.json(
        {
          job: {
            ...job,
            status: "scheduled",
            attemptCount: 1,
            providerPostId: postiz.id,
          },
          execution: "scheduled",
          provider: "postiz",
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Postiz publishing failed:", error);

      await tx
        .update(marketingPublishJobs)
        .set({
          status: "failed",
          attemptCount: 1,
          failedAt: new Date(),
          failureCode: "POSTIZ_PUBLISH_FAILED",
          failureMessageSafe:
            "Postiz could not schedule this social media post.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(marketingPublishJobs.id, job.id),
            eq(marketingPublishJobs.businessId, access.businessId),
          ),
        );

      return NextResponse.json(
        {
          error: "Postiz could not schedule this social media post.",
          code: "POSTIZ_PUBLISH_FAILED",
        },
        { status: 502 },
      );
    }
  });
}
