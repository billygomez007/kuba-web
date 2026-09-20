import crypto from "crypto";

const NOTION_AUTHORIZE_URL =
  "https://api.notion.com/v1/oauth/authorize";

const NOTION_TOKEN_URL =
  "https://api.notion.com/v1/oauth/token";

const NOTION_API =
  "https://api.notion.com/v1";

const NOTION_VERSION =
  "2022-06-28";

function required(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    );
  }

  return value;
}

function stateSecret() {
  return (
    process.env.NOTION_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function createNotionState(
  input: {
    businessId: string;
    userId: string;
  },
) {
  const payload =
    Buffer.from(
      JSON.stringify({
        businessId:
          input.businessId,
        userId:
          input.userId,
        issuedAt:
          Date.now(),
        nonce:
          crypto
            .randomBytes(16)
            .toString("hex"),
      }),
    ).toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        stateSecret(),
      )
      .update(payload)
      .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifyNotionState(
  value: string,
) {
  const [
    payload,
    signature,
  ] =
    value.split(".");

  if (
    !payload ||
    !signature
  ) {
    throw new Error(
      "Invalid Notion OAuth state.",
    );
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        stateSecret(),
      )
      .update(payload)
      .digest();

  const supplied =
    Buffer.from(
      signature,
      "base64url",
    );

  if (
    expected.length !==
      supplied.length ||
    !crypto.timingSafeEqual(
      expected,
      supplied,
    )
  ) {
    throw new Error(
      "Invalid Notion OAuth state signature.",
    );
  }

  const parsed =
    JSON.parse(
      Buffer.from(
        payload,
        "base64url",
      ).toString("utf8"),
    ) as {
      businessId: string;
      userId: string;
      issuedAt: number;
      nonce: string;
    };

  if (
    !parsed.businessId ||
    !parsed.userId ||
    !parsed.issuedAt ||
    Date.now() -
      parsed.issuedAt >
      15 * 60 * 1000
  ) {
    throw new Error(
      "Expired Notion OAuth state.",
    );
  }

  return parsed;
}

export function notionAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      NOTION_AUTHORIZE_URL,
    );

  url.searchParams.set(
    "owner",
    "user",
  );

  url.searchParams.set(
    "client_id",
    required(
      "NOTION_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "NOTION_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

function basicAuthorization() {
  return (
    "Basic " +
    Buffer.from(
      `${required(
        "NOTION_CLIENT_ID",
      )}:${required(
        "NOTION_CLIENT_SECRET",
      )}`,
    ).toString("base64")
  );
}

export async function exchangeNotionCode(
  code: string,
) {
  const response =
    await fetch(
      NOTION_TOKEN_URL,
      {
        method: "POST",
        headers: {
          Authorization:
            basicAuthorization(),
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            grant_type:
              "authorization_code",
            code,
            redirect_uri:
              required(
                "NOTION_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token ||
    !data.workspace_id
  ) {
    throw new Error(
      data.message ||
      data.error ||
      "Notion token exchange failed.",
    );
  }

  return {
    accessToken:
      String(
        data.access_token,
      ),
    tokenType:
      data.token_type
        ? String(
            data.token_type,
          )
        : "bearer",
    botId:
      data.bot_id
        ? String(
            data.bot_id,
          )
        : null,
    workspaceId:
      String(
        data.workspace_id,
      ),
    workspaceName:
      data.workspace_name
        ? String(
            data.workspace_name,
          )
        : "Notion",
    workspaceIcon:
      data.workspace_icon
        ? String(
            data.workspace_icon,
          )
        : null,
    duplicatedTemplateId:
      data.duplicated_template_id
        ? String(
            data.duplicated_template_id,
          )
        : null,
  };
}

async function notionFetch(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response =
    await fetch(
      `${NOTION_API}${path}`,
      {
        ...init,
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Notion-Version":
            NOTION_VERSION,
          "Content-Type":
            "application/json",
          ...(init?.headers ||
            {}),
        },
      },
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.code ||
      "Notion API request failed.",
    );
  }

  return data;
}

export async function getNotionBotIdentity(
  accessToken: string,
) {
  const data =
    await notionFetch(
      "/users/me",
      accessToken,
    );

  if (!data?.id) {
    throw new Error(
      "Notion integration identity could not be verified.",
    );
  }

  return {
    id:
      String(
        data.id,
      ),
    name:
      data.name
        ? String(
            data.name,
          )
        : "SuperKuba",
    type:
      data.type
        ? String(
            data.type,
          )
        : null,
  };
}

export async function searchNotionWorkspace(
  accessToken: string,
) {
  const data =
    await notionFetch(
      "/search",
      accessToken,
      {
        method:
          "POST",
        body:
          JSON.stringify({
            page_size:
              25,
            sort: {
              direction:
                "descending",
              timestamp:
                "last_edited_time",
            },
          }),
      },
    );

  const results =
    Array.isArray(
      data?.results,
    )
      ? data.results
      : [];

  return results.map(
    (
      result:
        Record<
          string,
          unknown
        >,
    ) => ({
      id:
        String(
          result.id ||
          "",
        ),
      object:
        result.object
          ? String(
              result.object,
            )
          : null,
      url:
        result.url
          ? String(
              result.url,
            )
          : null,
      lastEditedTime:
        result.last_edited_time
          ? String(
              result.last_edited_time,
            )
          : null,
    }),
  );
}
