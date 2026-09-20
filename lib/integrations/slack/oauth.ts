import crypto from "crypto";

const SLACK_AUTHORIZE_URL =
  "https://slack.com/oauth/v2/authorize";

const SLACK_TOKEN_URL =
  "https://slack.com/api/oauth.v2.access";

const SLACK_API =
  "https://slack.com/api";

const scopes = [
  "chat:write",
  "channels:read",
  "groups:read",
  "users:read",
];

function required(name: string) {
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
    process.env.SLACK_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function createSlackState(
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

export function verifySlackState(
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
      "Invalid Slack OAuth state.",
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
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(
      expected,
      supplied,
    )
  ) {
    throw new Error(
      "Invalid Slack OAuth state signature.",
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
      "Expired Slack OAuth state.",
    );
  }

  return parsed;
}

export function slackAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      SLACK_AUTHORIZE_URL,
    );

  url.searchParams.set(
    "client_id",
    required(
      "SLACK_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "scope",
    scopes.join(","),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "SLACK_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

function slackBasicAuth() {
  return (
    "Basic " +
    Buffer.from(
      `${required(
        "SLACK_CLIENT_ID",
      )}:${required(
        "SLACK_CLIENT_SECRET",
      )}`,
    ).toString("base64")
  );
}

export async function exchangeSlackCode(
  code: string,
) {
  const response =
    await fetch(
      SLACK_TOKEN_URL,
      {
        method: "POST",
        headers: {
          Authorization:
            slackBasicAuth(),
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          new URLSearchParams({
            code,
            redirect_uri:
              required(
                "SLACK_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.ok ||
    !data.access_token ||
    !data.team?.id
  ) {
    throw new Error(
      data.error ||
      "Slack token exchange failed.",
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
        : "bot",
    scope:
      data.scope
        ? String(
            data.scope,
          )
        : "",
    botUserId:
      data.bot_user_id
        ? String(
            data.bot_user_id,
          )
        : null,
    appId:
      data.app_id
        ? String(
            data.app_id,
          )
        : null,
    teamId:
      String(
        data.team.id,
      ),
    teamName:
      data.team.name
        ? String(
            data.team.name,
          )
        : "Slack",
    enterpriseId:
      data.enterprise?.id
        ? String(
            data.enterprise.id,
          )
        : null,
  };
}

async function slackApi(
  method: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response =
    await fetch(
      `${SLACK_API}/${method}`,
      {
        ...init,
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json; charset=utf-8",
          ...(init?.headers ||
            {}),
        },
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      `Slack ${method} failed.`,
    );
  }

  return data;
}

export async function verifySlackIdentity(
  accessToken: string,
) {
  const data =
    await slackApi(
      "auth.test",
      accessToken,
      {
        method: "POST",
      },
    );

  return {
    teamId:
      data.team_id
        ? String(
            data.team_id,
          )
        : null,
    teamName:
      data.team
        ? String(
            data.team,
          )
        : null,
    userId:
      data.user_id
        ? String(
            data.user_id,
          )
        : null,
    botId:
      data.bot_id
        ? String(
            data.bot_id,
          )
        : null,
    url:
      data.url
        ? String(
            data.url,
          )
        : null,
  };
}

export async function listSlackChannels(
  accessToken: string,
) {
  const url =
    new URL(
      `${SLACK_API}/conversations.list`,
    );

  url.searchParams.set(
    "types",
    "public_channel,private_channel",
  );

  url.searchParams.set(
    "exclude_archived",
    "true",
  );

  url.searchParams.set(
    "limit",
    "200",
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      "Unable to list Slack channels.",
    );
  }

  return Array.isArray(
    data.channels,
  )
    ? data.channels.map(
        (
          channel:
            Record<
              string,
              unknown
            >,
        ) => ({
          id:
            String(
              channel.id ||
              "",
            ),
          name:
            String(
              channel.name ||
              "",
            ),
          isPrivate:
            Boolean(
              channel.is_private,
            ),
          isMember:
            Boolean(
              channel.is_member,
            ),
        }),
      )
    : [];
}

export async function sendSlackMessage(
  accessToken: string,
  channel: string,
  text: string,
) {
  return slackApi(
    "chat.postMessage",
    accessToken,
    {
      method: "POST",
      body:
        JSON.stringify({
          channel,
          text,
        }),
    },
  );
}
