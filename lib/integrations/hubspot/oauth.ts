import crypto from "crypto";

const HUBSPOT_AUTH_URL =
  "https://app.hubspot.com/oauth/authorize";

const HUBSPOT_TOKEN_URL =
  "https://api.hubapi.com/oauth/v1/token";

const HUBSPOT_API =
  "https://api.hubapi.com";

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
    process.env.HUBSPOT_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

const scopes = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.contacts.read",
  "crm.schemas.companies.read",
  "crm.schemas.deals.read",
  "oauth",
];

export function createHubSpotState(
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

export function verifyHubSpotState(
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
      "Invalid HubSpot OAuth state.",
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
      "Invalid HubSpot OAuth state signature.",
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
      "Expired HubSpot OAuth state.",
    );
  }

  return parsed;
}

export function hubSpotAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      HUBSPOT_AUTH_URL,
    );

  url.searchParams.set(
    "client_id",
    required(
      "HUBSPOT_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "HUBSPOT_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "scope",
    scopes.join(" "),
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

export async function exchangeHubSpotCode(
  code: string,
) {
  const response =
    await fetch(
      HUBSPOT_TOKEN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",
            client_id:
              required(
                "HUBSPOT_CLIENT_ID",
              ),
            client_secret:
              required(
                "HUBSPOT_CLIENT_SECRET",
              ),
            redirect_uri:
              required(
                "HUBSPOT_REDIRECT_URI",
              ),
            code,
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
      data.message ||
      data.error_description ||
      data.error ||
      "HubSpot token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
}

async function hubSpotGet(
  path: string,
  accessToken: string,
) {
  const response =
    await fetch(
      `${HUBSPOT_API}${path}`,
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
      data?.message ||
      "HubSpot API request failed.",
    );
  }

  return data;
}

export async function getHubSpotAccount(
  accessToken: string,
) {
  const data =
    await hubSpotGet(
      "/oauth/v1/access-tokens/" +
        encodeURIComponent(
          accessToken,
        ),
      accessToken,
    );

  return {
    hubId:
      data.hub_id
        ? String(
            data.hub_id,
          )
        : null,
    user:
      data.user
        ? String(
            data.user,
          )
        : null,
    scopes:
      Array.isArray(
        data.scopes,
      )
        ? data.scopes.map(
            String,
          )
        : [],
  };
}

export async function verifyHubSpotCrmAccess(
  accessToken: string,
) {
  const [
    contacts,
    companies,
    deals,
  ] =
    await Promise.all([
      hubSpotGet(
        "/crm/v3/objects/contacts?limit=1",
        accessToken,
      ),
      hubSpotGet(
        "/crm/v3/objects/companies?limit=1",
        accessToken,
      ),
      hubSpotGet(
        "/crm/v3/objects/deals?limit=1",
        accessToken,
      ),
    ]);

  return {
    contactsReady:
      Array.isArray(
        contacts.results,
      ),
    companiesReady:
      Array.isArray(
        companies.results,
      ),
    dealsReady:
      Array.isArray(
        deals.results,
      ),
  };
}
