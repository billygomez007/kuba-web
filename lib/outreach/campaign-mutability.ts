import type { CampaignStatus } from "@/lib/outreach/campaign-state";

/**
 * Centralized campaign editability rules (approved spec, section 2). Never
 * duplicate these checks inline in a route or service function — call
 * assertCampaignFieldEditable instead, so the rule can only be changed in
 * one place.
 *
 *  - draft: everything is editable — nothing has executed yet.
 *  - scheduled: only non-execution-affecting fields (name/description).
 *    Approval already happened (see section 15 / section 3's launch
 *    snapshot); silently changing sequence/recipients/scheduling after
 *    that would change what was approved without a new approval event.
 *  - running/paused/completed/stopped/failed: nothing is editable.
 *    Historical sent content must never be rewritten (section 16). This
 *    intentionally does not build a versioning engine for v1 — it simply
 *    refuses the edit outright once a campaign has started.
 */
export type CampaignMutationField =
  | "name"
  | "description"
  | "sequence"
  | "recipients"
  | "personalization"
  | "scheduling";

const DRAFT_EDITABLE_FIELDS: readonly CampaignMutationField[] = [
  "name",
  "description",
  "sequence",
  "recipients",
  "personalization",
  "scheduling",
];

const SCHEDULED_EDITABLE_FIELDS: readonly CampaignMutationField[] = ["name", "description"];

export function isCampaignFieldEditable(status: CampaignStatus, field: CampaignMutationField): boolean {
  if (status === "draft") return DRAFT_EDITABLE_FIELDS.includes(field);
  if (status === "scheduled") return SCHEDULED_EDITABLE_FIELDS.includes(field);
  return false;
}

export function assertCampaignFieldEditable(status: CampaignStatus, field: CampaignMutationField): void {
  if (!isCampaignFieldEditable(status, field)) {
    throw new Error(`Cannot edit "${field}" while the campaign is "${status}".`);
  }
}

/** A draft campaign is safe to hard-delete (no send/recipient history can exist yet — sends are only created at launch). */
export function isCampaignDeletable(status: CampaignStatus): boolean {
  return status === "draft";
}
