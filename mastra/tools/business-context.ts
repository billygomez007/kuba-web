type TrustedContextKey = "businessId" | "employeeId" | "conversationId" | "channel";

type TrustedRequestContext = {
  get(key: never): unknown;
};

function readTrustedContextValue(
  requestContext: TrustedRequestContext,
  key: TrustedContextKey,
): string | undefined {
  const get = requestContext.get as unknown as (
    key: TrustedContextKey,
  ) => unknown;

  const value = get.call(requestContext, key);

  return typeof value === "string" && value.length > 0
    ? value
    : undefined;
}

/**
 * The business ID a tool call executes against must come from the server-pinned
 * RequestContext set when the agent was invoked, never from the model's tool-call
 * arguments. A model can be prompt-injected by untrusted message content into
 * emitting an arbitrary businessId; RequestContext is set once, server-side,
 * before the agent run starts and is not model-writable.
 */
export function requireBusinessId(
  requestContext: TrustedRequestContext,
): string {
  const businessId = readTrustedContextValue(
    requestContext,
    "businessId",
  );

  if (!businessId) {
    throw new Error(
      "Missing trusted business context for tool execution.",
    );
  }

  return businessId;
}

/**
 * Same trust model as requireBusinessId: the AI employee ID a tool's
 * actions are attributed to and checked against must come from the
 * server-pinned RequestContext set after the employee has been
 * authenticated, tenant-scoped, type-checked, and confirmed active —
 * never accepted from the model's tool-call arguments as authorization.
 * Every route that invokes an agent must resolve and tenant-verify the
 * acting AI employee before constructing RequestContext.
 */
export function requireEmployeeId(
  requestContext: TrustedRequestContext,
): string {
  const employeeId = readTrustedContextValue(
    requestContext,
    "employeeId",
  );

  if (!employeeId) {
    throw new Error(
      "Missing trusted AI employee context for tool execution.",
    );
  }

  return employeeId;
}

/**
 * The live customer conversation a tool call is acting on, when one exists.
 * Unlike businessId/employeeId this is genuinely OPTIONAL: dashboard/test-
 * console chat sessions (GenericChatWorkspace, the per-employee test page)
 * have no backing `conversations` row at all, only a Mastra memory thread.
 * Handoff only makes sense for a real, trackable customer conversation, so
 * callers check for undefined and fail gracefully rather than throwing.
 */
export function readConversationId(
  requestContext: TrustedRequestContext,
): string | undefined {
  return readTrustedContextValue(requestContext, "conversationId");
}

/**
 * The inbound channel a tool call is running on (e.g. "website_chat",
 * "whatsapp"). Defaults to "dashboard" for internal test/console sessions,
 * which are always channel-eligible — the real security boundary is tenant/
 * entitlement scoping, not this soft eligibility hint.
 */
export function readChannel(
  requestContext: TrustedRequestContext,
): string {
  return readTrustedContextValue(requestContext, "channel") ?? "dashboard";
}
