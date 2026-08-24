import type { RequestContext } from "@mastra/core/request-context";

/**
 * The business ID a tool call executes against must come from the server-pinned
 * RequestContext set when the agent was invoked, never from the model's tool-call
 * arguments. A model can be prompt-injected by untrusted message content into
 * emitting an arbitrary businessId; RequestContext is set once, server-side,
 * before the agent run starts and is not model-writable.
 */
export function requireBusinessId(requestContext: RequestContext): string {
  const businessId = requestContext.get("businessId") as string | undefined;

  if (!businessId) {
    throw new Error(
      "Missing trusted business context for tool execution.",
    );
  }

  return businessId;
}
