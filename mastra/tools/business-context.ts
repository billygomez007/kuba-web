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

/**
 * Same trust model as requireBusinessId: the employee ID a tool's actions
 * are attributed to and checked against must come from the server-pinned
 * RequestContext set before the agent run started, never from the model's
 * tool-call arguments. Every route that invokes an agent must resolve and
 * tenant-verify the acting AI employee before constructing RequestContext.
 */
export function requireEmployeeId(requestContext: RequestContext): string {
  const employeeId = requestContext.get("employeeId") as string | undefined;

  if (!employeeId) {
    throw new Error(
      "Missing trusted AI employee context for tool execution.",
    );
  }

  return employeeId;
}
