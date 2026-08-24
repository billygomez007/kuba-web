import crypto from "node:crypto";

export function verifyStripeWebhookSignature(payload: string, signature: string | null, toleranceSeconds = 300) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const timestamp = Number(signature.split(",").find((item) => item.startsWith("t="))?.slice(2));
  const signatures = signature.split(",").filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!Number.isFinite(timestamp) || !signatures.length || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((candidate) => candidate.length === expected.length && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected)));
}
