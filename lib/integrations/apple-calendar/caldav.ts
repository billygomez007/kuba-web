export type CalDavCredentials = {
  serverUrl: string;
  username: string;
  password: string;
};

export type CalDavVerification = {
  serverUrl: string;
  principalUrl: string | null;
  calendarHomeUrl: string | null;
};

function normalizeServerUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(
      "CalDAV server URL is required.",
    );
  }

  const url = new URL(trimmed);

  if (
    url.protocol !== "https:"
  ) {
    throw new Error(
      "CalDAV server must use HTTPS.",
    );
  }

  return url.toString();
}

function basicAuth(
  username: string,
  password: string,
) {
  return (
    "Basic " +
    Buffer.from(
      `${username}:${password}`,
    ).toString("base64")
  );
}

function absoluteDavUrl(
  base: string,
  path: string | null,
) {
  if (!path) return null;

  try {
    return new URL(
      path,
      base,
    ).toString();
  } catch {
    return null;
  }
}

function extractHref(
  xml: string,
  marker:
    | "current-user-principal"
    | "calendar-home-set",
) {
  const escaped =
    marker.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&",
    );

  const expression =
    new RegExp(
      `<[^>]*${escaped}[^>]*>[\\s\\S]*?<[^>]*href[^>]*>([^<]+)<\\/[^>]*href>`,
      "i",
    );

  const match =
    xml.match(expression);

  return match?.[1]?.trim() ||
    null;
}

async function propfind(
  url: string,
  credentials: CalDavCredentials,
  body: string,
) {
  const response =
    await fetch(url, {
      method: "PROPFIND",
      redirect: "follow",
      headers: {
        Authorization:
          basicAuth(
            credentials.username,
            credentials.password,
          ),
        Depth: "0",
        "Content-Type":
          "application/xml; charset=utf-8",
      },
      body,
    });

  const text =
    await response.text();

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    throw new Error(
      "Apple/CalDAV credentials were rejected.",
    );
  }

  if (
    response.status < 200 ||
    response.status >= 400
  ) {
    throw new Error(
      `CalDAV verification failed with status ${response.status}.`,
    );
  }

  return {
    response,
    text,
  };
}

export async function verifyCalDavConnection(
  input: CalDavCredentials,
): Promise<CalDavVerification> {
  const serverUrl =
    normalizeServerUrl(
      input.serverUrl,
    );

  const username =
    input.username.trim();

  const password =
    input.password.trim();

  if (!username || !password) {
    throw new Error(
      "Username and app-specific password are required.",
    );
  }

  const credentials = {
    serverUrl,
    username,
    password,
  };

  const principalResult =
    await propfind(
      serverUrl,
      credentials,
      `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`,
    );

  const principalPath =
    extractHref(
      principalResult.text,
      "current-user-principal",
    );

  const principalUrl =
    absoluteDavUrl(
      serverUrl,
      principalPath,
    );

  let calendarHomeUrl:
    string | null = null;

  if (principalUrl) {
    const homeResult =
      await propfind(
        principalUrl,
        credentials,
        `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`,
      );

    calendarHomeUrl =
      absoluteDavUrl(
        principalUrl,
        extractHref(
          homeResult.text,
          "calendar-home-set",
        ),
      );
  }

  return {
    serverUrl,
    principalUrl,
    calendarHomeUrl,
  };
}
