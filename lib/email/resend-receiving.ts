export interface ResendReceivedEmail {
  id: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  headers?: Record<string, string>;
  attachments?: unknown[];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Resend's email.received webhook identifies the received email but does not
 * include its complete body. Retrieve the canonical received-email resource
 * before persisting the inbound message.
 *
 * Keep the outbound send-only RESEND_API_KEY least-privileged. Production
 * inbound retrieval uses a separate server-only full-access key.
 */
export async function retrieveResendReceivedEmail(
  emailId: string,
): Promise<ResendReceivedEmail> {
  const apiKey = process.env.RESEND_RECEIVING_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_RECEIVING_API_KEY is required to retrieve inbound email.",
    );
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `Resend received-email retrieval failed with HTTP ${response.status}${
        responseText ? `: ${responseText.slice(0, 500)}` : ""
      }`,
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;

  const id = optionalString(payload.id);
  if (!id || id !== emailId) {
    throw new Error("Resend received-email response did not match requested email.");
  }

  const rawHeaders =
    payload.headers && typeof payload.headers === "object"
      ? (payload.headers as Record<string, unknown>)
      : undefined;

  const headers = rawHeaders
    ? Object.fromEntries(
        Object.entries(rawHeaders).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : undefined;

  return {
    id,
    from: optionalString(payload.from),
    to: optionalStringArray(payload.to),
    subject: optionalString(payload.subject),
    text: optionalString(payload.text),
    html: optionalString(payload.html),
    messageId: optionalString(payload.message_id),
    headers,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments
      : undefined,
  };
}
