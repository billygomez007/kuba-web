import { requireCampaignAccess } from "@/lib/outreach/campaign-route-context";

export async function requireMarketingAccess(mode: "view" | "manage" = "view") {
  return requireCampaignAccess(mode);
}

export const MARKETING_CHANNELS = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube", "telegram", "email", "whatsapp", "website", "other"] as const;
export const MARKETING_CONTENT_TYPES = ["post", "story", "reel", "short_video", "long_video", "email", "ad_copy", "article", "graphic", "carousel", "other"] as const;
export const SAFE_AUDIENCE_FIELDS = ["lead_stage", "deal_stage", "customer_status", "product_interest", "source", "engagement_recency", "location", "tag", "repeat_customer"] as const;

export function jsonObject(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try { return JSON.stringify(value); } catch { return null; }
}

export function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
