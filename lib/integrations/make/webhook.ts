export type MakeWebhookConfig = {
  webhookUrl: string;
  apiKey?: string | null;
};

function isAllowedMakeHost(
  hostname: string,
) {
  const value =
    hostname.toLowerCase();

  return (
    value === "hook.make.com" ||
    (
      value.startsWith("hook.") &&
      value.endsWith(".make.com")
    )
  );
}

export function normalizeMakeWebhookUrl(
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
      "Make webhook must use HTTPS.",
    );
  }

  if (
    !isAllowedMakeHost(
      url.hostname,
    )
  ) {
    throw new Error(
      "Enter a valid Make Custom Webhook URL.",
    );
  }

  if (
    !url.pathname ||
    url.pathname === "/"
  ) {
    throw new Error(
      "Make webhook path is missing.",
    );
  }

  url.hash = "";

  return url.toString();
}

export async function sendMakeWebhook(
  config: MakeWebhookConfig,
  payload: Record<
    string,
    unknown
  >,
) {
  const target =
    normalizeMakeWebhookUrl(
      config.webhookUrl,
    );

  const headers:
    Record<string, string> = {
      "Content-Type":
        "application/json",
      "User-Agent":
        "SuperKuba-Make/1.0",
    };

  const apiKey =
    config.apiKey?.trim();

  if (apiKey) {
    headers[
      "x-make-apikey"
    ] = apiKey;
  }

  const response =
    await fetch(
      target,
      {
        method:
          "POST",
        headers,
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
      `Make webhook returned ${response.status}.`,
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
