export const MARKETING_CONTENT_TYPES = [
  "post",
  "email",
  "article",
  "ad",
  "video",
  "story",
  "reel",
  "sms",
  "other",
] as const;

export type MarketingContentType =
  (typeof MARKETING_CONTENT_TYPES)[number];

export function isMarketingContentType(
  value: unknown,
): value is MarketingContentType {
  return (
    typeof value === "string" &&
    MARKETING_CONTENT_TYPES.includes(value as MarketingContentType)
  );
}
