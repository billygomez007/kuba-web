import crypto from "crypto";

const GRAPH_API = "https://graph.microsoft.com/v1.0";

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
    "common"
  );
}

function authorityBase() {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0`;
}

function stateSecret() {
  return (
    process.env.MICROSOFT_INTEGRATION_STATE_SECRET?.trim() ||
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
  "Calendars.ReadWrite",
];

export function createMicrosoftState(input: {
  businessId: string;
  userId: string;
}) {
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

export function verifyMicrosoftState(
  value: string,
) {
  const [payload, signature] =
    value.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Microsoft OAuth state.",
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
      "Invalid Microsoft OAuth state signature.",
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
      "Expired Microsoft OAuth state.",
    );
  }

  return parsed;
}

export function microsoftAuthorizationUrl(
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
      "MICROSOFT_INTEGRATION_REDIRECT_URI",
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

export async function exchangeMicrosoftCode(
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
                "MICROSOFT_INTEGRATION_REDIRECT_URI",
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
      "Microsoft token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
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

export async function getMicrosoftIdentity(
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
        "Microsoft 365",
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

export async function listMicrosoftCalendars(
  accessToken: string,
) {
  const data =
    await graphGet(
      "/me/calendars?$select=id,name,canEdit,owner",
      accessToken,
    );

  return Array.isArray(
    data.value,
  )
    ? data.value.map(
        (calendar: any) => ({
          id:
            String(
              calendar.id,
            ),
          name:
            String(
              calendar.name ||
              "Calendar",
            ),
          canEdit:
            Boolean(
              calendar.canEdit,
            ),
          owner:
            calendar.owner
              ? {
                  name:
                    calendar.owner
                      .name
                      ? String(
                          calendar.owner
                            .name,
                        )
                      : null,
                  address:
                    calendar.owner
                      .address
                      ? String(
                          calendar.owner
                            .address,
                        )
                      : null,
                }
              : null,
        }),
      )
    : [];
}
