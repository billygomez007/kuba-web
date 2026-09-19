import crypto from "crypto";

const DEFAULT_AUTH_BASE =
  "https://login.salesforce.com";

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    );
  }

  return value;
}

function authBase() {
  return (
    process.env.SALESFORCE_AUTH_BASE_URL?.trim() ||
    DEFAULT_AUTH_BASE
  );
}

function stateSecret() {
  return (
    process.env.SALESFORCE_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function createSalesforceState(input: {
  businessId: string;
  userId: string;
}) {
  const payload =
    Buffer.from(
      JSON.stringify({
        businessId: input.businessId,
        userId: input.userId,
        issuedAt: Date.now(),
        nonce: crypto
          .randomBytes(16)
          .toString("hex"),
      }),
    ).toString("base64url");

  const signature = crypto
    .createHmac(
      "sha256",
      stateSecret(),
    )
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifySalesforceState(
  state: string,
) {
  const [payload, signature] =
    state.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Salesforce OAuth state.",
    );
  }

  const expected = crypto
    .createHmac(
      "sha256",
      stateSecret(),
    )
    .update(payload)
    .digest();

  const supplied = Buffer.from(
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
      "Invalid Salesforce OAuth state signature.",
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
    Date.now() - parsed.issuedAt >
      15 * 60 * 1000
  ) {
    throw new Error(
      "Expired Salesforce OAuth state.",
    );
  }

  return parsed;
}

export function salesforceAuthorizationUrl(
  state: string,
) {
  const url = new URL(
    `${authBase()}/services/oauth2/authorize`,
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "client_id",
    required(
      "SALESFORCE_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "SALESFORCE_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "state",
    state,
  );

  url.searchParams.set(
    "scope",
    "api refresh_token offline_access",
  );

  return url.toString();
}

export async function exchangeSalesforceCode(
  code: string,
) {
  const response =
    await fetch(
      `${authBase()}/services/oauth2/token`,
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
            code,
            client_id:
              required(
                "SALESFORCE_CLIENT_ID",
              ),
            client_secret:
              required(
                "SALESFORCE_CLIENT_SECRET",
              ),
            redirect_uri:
              required(
                "SALESFORCE_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token ||
    !data.instance_url
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Salesforce token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    instance_url: string;
    id?: string;
    token_type?: string;
    issued_at?: string;
    signature?: string;
  };
}

async function salesforceGet(
  instanceUrl: string,
  accessToken: string,
  path: string,
) {
  const response =
    await fetch(
      `${instanceUrl}${path}`,
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
      data?.[0]?.message ||
      data?.message ||
      "Salesforce API request failed.",
    );
  }

  return data;
}

export async function getSalesforceIdentity(
  instanceUrl: string,
  accessToken: string,
) {
  const versions =
    await salesforceGet(
      instanceUrl,
      accessToken,
      "/services/data/",
    );

  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(
      "Salesforce API versions are unavailable.",
    );
  }

  const latest =
    versions[versions.length - 1];

  const version =
    typeof latest?.version === "string"
      ? latest.version
      : "61.0";

  const identity =
    await salesforceGet(
      instanceUrl,
      accessToken,
      `/services/data/v${version}/chatter/users/me`,
    );

  return {
    version,
    id:
      identity?.id
        ? String(identity.id)
        : null,
    name:
      identity?.name
        ? String(identity.name)
        : "Salesforce",
    email:
      identity?.email
        ? String(identity.email)
        : null,
    organizationId:
      identity?.organizationId
        ? String(
            identity.organizationId,
          )
        : null,
  };
}

export async function verifySalesforceCrmAccess(
  instanceUrl: string,
  accessToken: string,
  version: string,
) {
  const [
    contacts,
    accounts,
    opportunities,
  ] = await Promise.all([
    salesforceGet(
      instanceUrl,
      accessToken,
      `/services/data/v${version}/query?q=${encodeURIComponent(
        "SELECT Id FROM Contact LIMIT 1",
      )}`,
    ),
    salesforceGet(
      instanceUrl,
      accessToken,
      `/services/data/v${version}/query?q=${encodeURIComponent(
        "SELECT Id FROM Account LIMIT 1",
      )}`,
    ),
    salesforceGet(
      instanceUrl,
      accessToken,
      `/services/data/v${version}/query?q=${encodeURIComponent(
        "SELECT Id FROM Opportunity LIMIT 1",
      )}`,
    ),
  ]);

  return {
    contactsReady:
      Array.isArray(contacts.records),
    accountsReady:
      Array.isArray(accounts.records),
    opportunitiesReady:
      Array.isArray(
        opportunities.records,
      ),
  };
}
