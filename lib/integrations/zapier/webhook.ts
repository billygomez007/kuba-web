export function normalizeZapierWebhookUrl(
  value: string,
) {
  const url =
    new URL(
      value.trim(),
    );

  if (
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Zapier webhook must use HTTPS.",
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    hostname !==
    "hooks.zapier.com"
  ) {
    throw new Error(
      "Enter a valid Zapier Catch Hook URL from hooks.zapier.com.",
    );
  }

  if (
    !url.pathname ||
    url.pathname === "/"
  ) {
    throw new Error(
      "Zapier webhook path is missing.",
    );
  }

  url.hash = "";

  return url.toString();
}

export async function sendZapierWebhook(
  webhookUrl: string,
  payload: Record<
    string,
    unknown
  >,
) {
  const target =
    normalizeZapierWebhookUrl(
      webhookUrl,
    );

  const response =
    await fetch(
      target,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "User-Agent":
            "SuperKuba-Zapier/1.0",
        },
        body:
          JSON.stringify(
            payload,
          ),
        redirect:
          "error",
      },
    );

  const text =
    await response
      .text()
      .catch(() => "");

  if (!response.ok) {
    throw new Error(
      `Zapier webhook returned ${response.status}.`,
    );
  }

  return {
    delivered: true,
    status:
      response.status,
    responsePreview:
      text.slice(
        0,
        500,
      ),
  };
}
