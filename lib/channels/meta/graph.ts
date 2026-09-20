const DEFAULT_GRAPH_VERSION = "v25.0";

function graphVersion() {
  return (
    process.env.META_GRAPH_API_VERSION ||
    DEFAULT_GRAPH_VERSION
  );
}

async function graphGet(
  path: string,
  params: Record<string, string>,
) {
  const url = new URL(
    `https://graph.facebook.com/${graphVersion()}/${path}`,
  );

  for (
    const [key, value]
    of Object.entries(params)
  ) {
    url.searchParams.set(
      key,
      value,
    );
  }

  const response =
    await fetch(url);

  const body =
    await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        "Meta Graph request failed.",
    );
  }

  return body;
}

export async function exchangeMetaCode(
  code: string,
) {
  const appId =
    process.env.META_APP_ID;

  const appSecret =
    process.env.META_APP_SECRET;

  const redirectUri =
    process.env.META_OAUTH_REDIRECT_URI;

  if (
    !appId ||
    !appSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Meta OAuth credentials are incomplete.",
    );
  }

  const result =
    await graphGet(
      "oauth/access_token",
      {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    );

  const accessToken =
    result?.access_token;

  if (
    typeof accessToken !== "string" ||
    !accessToken.trim()
  ) {
    throw new Error(
      "Meta did not return an access token.",
    );
  }

  return accessToken;
}

export async function getMetaPages(
  userAccessToken: string,
) {
  const result =
    await graphGet(
      "me/accounts",
      {
        fields:
          "id,name,access_token,instagram_business_account{id,username,name}",
        access_token:
          userAccessToken,
      },
    );

  return Array.isArray(result?.data)
    ? result.data
    : [];
}

export async function subscribeFacebookPage(
  pageId: string,
  pageAccessToken: string,
) {
  const version =
    process.env.META_GRAPH_API_VERSION ||
    "v25.0";

  const url = new URL(
    `https://graph.facebook.com/${version}/${pageId}/subscribed_apps`,
  );

  url.searchParams.set(
    "access_token",
    pageAccessToken,
  );

  url.searchParams.set(
    "subscribed_fields",
    [
      "messages",
      "messaging_postbacks",
      "message_deliveries",
      "message_reads",
    ].join(","),
  );

  const response =
    await fetch(url, {
      method: "POST",
    });

  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        "Unable to subscribe Facebook Page to Meta webhooks.",
    );
  }

  if (
    body?.success !== true
  ) {
    throw new Error(
      "Meta did not confirm Facebook Page subscription.",
    );
  }

  return true;
}

export async function verifyFacebookPageSubscription(
  pageId: string,
  pageAccessToken: string,
) {
  const version =
    process.env.META_GRAPH_API_VERSION ||
    "v25.0";

  const url = new URL(
    `https://graph.facebook.com/${version}/${pageId}/subscribed_apps`,
  );

  url.searchParams.set(
    "access_token",
    pageAccessToken,
  );

  const response =
    await fetch(url);

  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    return false;
  }

  return Array.isArray(body?.data) &&
    body.data.length > 0;
}
