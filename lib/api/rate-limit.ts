// Foundation inventory for the rate limiter selected in a future phase.
// These routes must be protected before high-volume production exposure.
export const RATE_LIMIT_SENSITIVE_ENDPOINTS = [
  "/api/auth/*",
  "/api/ai/*",
  "/api/messages/send",
  "/api/widget/chat",
  "/api/integrations/whatsapp/webhook",
  "/api/actions/execute",
  "/api/automations/process",
] as const;
