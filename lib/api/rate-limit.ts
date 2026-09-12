type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  namespace: string;
};

const entries = new Map<string, RateLimitEntry>();

function clientIdentifier(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const key = `${options.namespace}:${clientIdentifier(request)}`;
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  current.count += 1;

  if (current.count <= options.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}

export const RATE_LIMIT_SENSITIVE_ENDPOINTS = [
  "/api/auth/*",
  "/api/ai/*",
  "/api/messages/send",
  "/api/widget/chat",
  "/api/integrations/whatsapp/webhook",
  "/api/action-approvals/*/execute",
  "/api/ai-action-approvals/*/execute",
  "/api/automations/process",
] as const;
