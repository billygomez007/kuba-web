type TrustedContextKey = "businessId" | "employeeId";

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
 * The AI employee ID a tool call executes as must come from the server-pinned
 * RequestContext set after the employee has been authenticated, tenant-scoped,
 * type-checked, and confirmed active. Never accept employeeId from model
 * tool-call arguments as authorization.
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
