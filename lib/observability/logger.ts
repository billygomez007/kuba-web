type LogLevel = "error" | "warn" | "info";
type SafeLogEvent = { event: string; level?: LogLevel; requestId?: string | null; businessId?: string | null; actorId?: string | null; error?: unknown };

function errorSummary(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return error ? { name: "UnknownError" } : undefined;
}

/** Structured server log entry. Do not pass request bodies, secrets, or PII. */
export function logServerEvent({ event, level = "info", requestId = null, businessId = null, actorId = null, error }: SafeLogEvent) {
  const payload = { event, level, requestId, businessId, actorId, error: errorSummary(error), timestamp: new Date().toISOString() };
  const serialized = JSON.stringify(payload);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}
