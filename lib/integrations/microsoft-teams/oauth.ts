import crypto from "crypto";

const GRAPH_API =
  "https://graph.microsoft.com/v1.0";

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

function tenantId() {
  return (
    process.env.MICROSOFT_TENANT_ID?.trim() ||
    "organizations"
  );
}

function authorityBase() {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0`;
}

function stateSecret() {
  return (
    process.env.MICROSOFT_TEAMS_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

const scopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
];

export function createTeamsState(
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

export function verifyTeamsState(
  value: string,
) {
  const [
    payload,
    signature,
  ] =
    value.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Microsoft Teams OAuth state.",
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
      "Invalid Microsoft Teams OAuth state signature.",
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
      "Expired Microsoft Teams OAuth state.",
    );
  }

  return parsed;
}

export function teamsAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      `${authorityBase()}/authorize`,
    );

  url.searchParams.set(
    "client_id",
    required(
      "MICROSOFT_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "MICROSOFT_TEAMS_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "response_mode",
    "query",
  );

  url.searchParams.set(
    "scope",
    scopes.join(" "),
  );

  url.searchParams.set(
    "state",
    state,
  );

  url.searchParams.set(
    "prompt",
    "select_account",
  );

  return url.toString();
}

export async function exchangeTeamsCode(
  code: string,
) {
  const response =
    await fetch(
      `${authorityBase()}/token`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          new URLSearchParams({
            client_id:
              required(
                "MICROSOFT_CLIENT_ID",
              ),
            client_secret:
              required(
                "MICROSOFT_CLIENT_SECRET",
              ),
            redirect_uri:
              required(
                "MICROSOFT_TEAMS_REDIRECT_URI",
              ),
            grant_type:
              "authorization_code",
            code,
            scope:
              scopes.join(" "),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Microsoft Teams token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
}

async function graphGet(
  path: string,
  accessToken: string,
) {
  const response =
    await fetch(
      `${GRAPH_API}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Microsoft Graph request failed.",
    );
  }

  return data;
}

export async function getTeamsIdentity(
  accessToken: string,
) {
  const me =
    await graphGet(
      "/me?$select=id,displayName,mail,userPrincipalName",
      accessToken,
    );

  return {
    id:
      String(me.id),
    displayName:
      String(
        me.displayName ||
        me.mail ||
        me.userPrincipalName ||
        "Microsoft Teams",
      ),
    email:
      me.mail
        ? String(me.mail)
        : me.userPrincipalName
          ? String(
              me.userPrincipalName,
            )
          : null,
  };
}

export async function listJoinedTeams(
  accessToken: string,
) {
  const data =
    await graphGet(
      "/me/joinedTeams",
      accessToken,
    );

  return Array.isArray(
    data.value,
  )
    ? data.value.map(
        (
          team:
            Record<
              string,
              unknown
            >,
        ) => ({
          id:
            String(
              team.id ||
              "",
            ),
          displayName:
            String(
              team.displayName ||
              "",
            ),
          description:
            team.description
              ? String(
                  team.description,
                )
              : null,
        }),
      )
    : [];
}

export async function listTeamChannels(
  accessToken: string,
  teamId: string,
) {
  const data =
    await graphGet(
      `/teams/${encodeURIComponent(
        teamId,
      )}/channels`,
      accessToken,
    );

  return Array.isArray(
    data.value,
  )
    ? data.value.map(
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
          displayName:
            String(
              channel.displayName ||
              "",
            ),
          membershipType:
            channel.membershipType
              ? String(
                  channel.membershipType,
                )
              : null,
        }),
      )
    : [];
}
