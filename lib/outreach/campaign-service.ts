import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachCampaigns, outreachSequenceSteps } from "@/db/schema";
import { assertCampaignFieldEditable, isCampaignDeletable } from "@/lib/outreach/campaign-mutability";
import type { CampaignStatus } from "@/lib/outreach/campaign-state";

/**
 * Campaign + sequence-step CRUD — the domain/service layer routes call
 * into (section 40: routes stay thin). Editability is always checked via
 * lib/outreach/campaign-mutability.ts, never re-implemented here.
 */

export async function getCampaignOrThrow(businessId: string, campaignId: string) {
  const rows = await db
    .select()
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId)))
    .limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campaign not found for this business.");
  return campaign;
}

export async function listCampaigns(businessId: string) {
  return db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.businessId, businessId))
    .orderBy(desc(outreachCampaigns.updatedAt));
}

export interface CreateCampaignParams {
  businessId: string;
  employeeId: string;
  name: string;
  description?: string | null;
  channel?: string;
}

export async function createCampaign(params: CreateCampaignParams) {
  const name = params.name.trim();
  if (!name) throw new Error("Campaign name is required.");

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(outreachCampaigns).values({
    id,
    businessId: params.businessId,
    employeeId: params.employeeId,
    name,
    description: params.description ?? null,
    channel: params.channel ?? "email",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return getCampaignOrThrow(params.businessId, id);
}

export interface UpdateCampaignFieldsParams {
  name?: string;
  description?: string | null;
}

export async function updateCampaignFields(businessId: string, campaignId: string, patch: UpdateCampaignFieldsParams) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  const status = campaign.status as CampaignStatus;

  if (patch.name !== undefined) assertCampaignFieldEditable(status, "name");
  if (patch.description !== undefined) assertCampaignFieldEditable(status, "description");

  const name = patch.name !== undefined ? patch.name.trim() : undefined;
  if (name !== undefined && !name) throw new Error("Campaign name cannot be empty.");

  await db
    .update(outreachCampaigns)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaigns.id, campaignId));

  return getCampaignOrThrow(businessId, campaignId);
}

export async function deleteDraftCampaign(businessId: string, campaignId: string) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  if (!isCampaignDeletable(campaign.status as CampaignStatus)) {
    throw new Error(`Cannot delete a campaign that is "${campaign.status}" — only a draft campaign can be deleted.`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(outreachCampaignRecipients).where(eq(outreachCampaignRecipients.campaignId, campaignId));
    await tx.delete(outreachSequenceSteps).where(eq(outreachSequenceSteps.campaignId, campaignId));
    await tx.delete(outreachCampaigns).where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId)));
  });
}

// --- Sequence steps ---

export async function listSequenceSteps(businessId: string, campaignId: string) {
  await getCampaignOrThrow(businessId, campaignId);
  return db
    .select()
    .from(outreachSequenceSteps)
    .where(eq(outreachSequenceSteps.campaignId, campaignId))
    .orderBy(asc(outreachSequenceSteps.stepNumber));
}

export interface SequenceStepInput {
  delayHours: number;
  subjectTemplate?: string | null;
  bodyTemplate: string;
}

export async function addSequenceStep(businessId: string, campaignId: string, input: SequenceStepInput) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  assertCampaignFieldEditable(campaign.status as CampaignStatus, "sequence");
  if (!input.bodyTemplate.trim()) throw new Error("Sequence step body is required.");
  if (input.delayHours < 0) throw new Error("Sequence step delay cannot be negative.");

  const existing = await listSequenceSteps(businessId, campaignId);
  const nextStepNumber = existing.length === 0 ? 1 : existing[existing.length - 1].stepNumber + 1;

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(outreachSequenceSteps).values({
    id,
    businessId,
    campaignId,
    stepNumber: nextStepNumber,
    delayHours: input.delayHours,
    subjectTemplate: input.subjectTemplate ?? null,
    bodyTemplate: input.bodyTemplate,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateSequenceStep(
  businessId: string,
  campaignId: string,
  stepId: string,
  patch: Partial<SequenceStepInput>,
) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  assertCampaignFieldEditable(campaign.status as CampaignStatus, "sequence");

  if (patch.bodyTemplate !== undefined && !patch.bodyTemplate.trim()) {
    throw new Error("Sequence step body cannot be empty.");
  }
  if (patch.delayHours !== undefined && patch.delayHours < 0) {
    throw new Error("Sequence step delay cannot be negative.");
  }

  await db
    .update(outreachSequenceSteps)
    .set({
      ...(patch.delayHours !== undefined ? { delayHours: patch.delayHours } : {}),
      ...(patch.subjectTemplate !== undefined ? { subjectTemplate: patch.subjectTemplate } : {}),
      ...(patch.bodyTemplate !== undefined ? { bodyTemplate: patch.bodyTemplate } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(outreachSequenceSteps.id, stepId), eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.businessId, businessId)));
}

export async function removeSequenceStep(businessId: string, campaignId: string, stepId: string) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  assertCampaignFieldEditable(campaign.status as CampaignStatus, "sequence");

  await db.transaction(async (tx) => {
    await tx.delete(outreachSequenceSteps).where(and(eq(outreachSequenceSteps.id, stepId), eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.businessId, businessId)));
    // Renumber remaining steps to a contiguous 1..N sequence so
    // advanceRecipientAfterSend's "stepNumber + 1" lookup never skips a step.
    const remaining = await tx
      .select()
      .from(outreachSequenceSteps)
      .where(eq(outreachSequenceSteps.campaignId, campaignId))
      .orderBy(asc(outreachSequenceSteps.stepNumber));

    for (let index = 0; index < remaining.length; index += 1) {
      const desiredStepNumber = index + 1;
      if (remaining[index].stepNumber !== desiredStepNumber) {
        await tx
          .update(outreachSequenceSteps)
          .set({ stepNumber: desiredStepNumber, updatedAt: new Date() })
          .where(eq(outreachSequenceSteps.id, remaining[index].id));
      }
    }
  });
}

/** Reassigns step numbers to match the given order (1-indexed, contiguous). */
export async function reorderSequenceSteps(businessId: string, campaignId: string, orderedStepIds: string[]) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  assertCampaignFieldEditable(campaign.status as CampaignStatus, "sequence");

  const existing = await listSequenceSteps(businessId, campaignId);
  if (existing.length !== orderedStepIds.length || !existing.every((step) => orderedStepIds.includes(step.id))) {
    throw new Error("Reorder must include every existing sequence step exactly once.");
  }

  await db.transaction(async (tx) => {
    // A direct permutation (not just compaction) can otherwise transiently
    // collide with the (campaign_id, step_number) unique index — e.g.
    // swapping steps 1 and 2 tries to write step_number=1 for the new step
    // 1 while the old step 1 (soon to become 2) still holds that value.
    // Stage every row through a negative, guaranteed-unused number first.
    for (let index = 0; index < orderedStepIds.length; index += 1) {
      await tx
        .update(outreachSequenceSteps)
        .set({ stepNumber: -(index + 1) })
        .where(and(eq(outreachSequenceSteps.id, orderedStepIds[index]), eq(outreachSequenceSteps.campaignId, campaignId)));
    }
    for (let index = 0; index < orderedStepIds.length; index += 1) {
      await tx
        .update(outreachSequenceSteps)
        .set({ stepNumber: index + 1, updatedAt: new Date() })
        .where(and(eq(outreachSequenceSteps.id, orderedStepIds[index]), eq(outreachSequenceSteps.campaignId, campaignId)));
    }
  });
}
