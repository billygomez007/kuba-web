import crypto from "crypto";

const DEFAULT_ACCOUNTS_URL =
  "https://accounts.zoho.com";

const allowedAccountsHosts =
  new Set([
    "accounts.zoho.com",
    "accounts.zoho.eu",
    "accounts.zoho.in",
    "accounts.zoho.com.au",
    "accounts.zoho.com.cn",
    "accounts.zoho.jp",
    "accounts.zohocloud.ca",
  ]);

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

function normalizeAccountsUrl(
  candidate?: string | null,
) {
  const raw =
    candidate?.trim() ||
    process.env.ZOHO_ACCOUNTS_URL?.trim() ||
    DEFAULT_ACCOUNTS_URL;

  const url =
    new URL(raw);

  if (
    url.protocol !== "https:" ||
    !allowedAccountsHosts.has(
      url.hostname,
    )
  ) {
    throw new Error(
      "Unsupported Zoho Accounts domain.",
    );
  }

  return `${url.protocol}//${url.hostname}`;
}

function stateSecret() {
  return (
    process.env.ZOHO_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

const scopes = [
  "ZohoCRM.modules.leads.ALL",
  "ZohoCRM.modules.contacts.ALL",
  "ZohoCRM.modules.accounts.ALL",
  "ZohoCRM.modules.deals.ALL",
  "ZohoCRM.users.READ",
];

export function createZohoState(
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

export function verifyZohoState(
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
      "Invalid Zoho OAuth state.",
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
      "Invalid Zoho OAuth state signature.",
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
      "Expired Zoho OAuth state.",
    );
  }

  return parsed;
}

export function zohoAuthorizationUrl(
  state: string,
) {
  const accountsUrl =
    normalizeAccountsUrl();

  const url =
    new URL(
      `${accountsUrl}/oauth/v2/auth`,
    );

  url.searchParams.set(
    "scope",
    scopes.join(","),
  );

  url.searchParams.set(
    "client_id",
    required(
      "ZOHO_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "access_type",
    "offline",
  );

  url.searchParams.set(
    "prompt",
    "consent",
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "ZOHO_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

export async function exchangeZohoCode(
  code: string,
  accountsServer?: string | null,
) {
  const accountsUrl =
    normalizeAccountsUrl(
      accountsServer,
    );

  const response =
    await fetch(
      `${accountsUrl}/oauth/v2/token`,
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
                "ZOHO_CLIENT_ID",
              ),
            client_secret:
              required(
                "ZOHO_CLIENT_SECRET",
              ),
            redirect_uri:
              required(
                "ZOHO_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token ||
    !data.api_domain
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Zoho token exchange failed.",
    );
  }

  return {
    accessToken:
      String(
        data.access_token,
      ),
    refreshToken:
      data.refresh_token
        ? String(
            data.refresh_token,
          )
        : null,
    expiresIn:
      typeof data.expires_in ===
      "number"
        ? data.expires_in
        : 3600,
    tokenType:
      data.token_type
        ? String(
            data.token_type,
          )
        : "Bearer",
    apiDomain:
      String(
        data.api_domain,
      ),
    accountsUrl,
  };
}

function validateApiDomain(
  candidate: string,
) {
  const url =
    new URL(candidate);

  if (
    url.protocol !== "https:" ||
    !(
      url.hostname ===
        "www.zohoapis.com" ||
      url.hostname.endsWith(
        ".zohoapis.com",
      ) ||
      url.hostname.endsWith(
        ".zohoapis.eu",
      ) ||
      url.hostname.endsWith(
        ".zohoapis.in",
      ) ||
      url.hostname.endsWith(
        ".zohoapis.com.au",
      ) ||
      url.hostname.endsWith(
        ".zohoapis.com.cn",
      ) ||
      url.hostname.endsWith(
        ".zohoapis.jp",
      ) ||
      url.hostname.endsWith(
        ".zohocloud.ca",
      )
    )
  ) {
    throw new Error(
      "Unsupported Zoho API domain.",
    );
  }

  return `${url.protocol}//${url.hostname}`;
}

async function zohoGet(
  apiDomain: string,
  accessToken: string,
  path: string,
) {
  const base =
    validateApiDomain(
      apiDomain,
    );

  const response =
    await fetch(
      `${base}${path}`,
      {
        headers: {
          Authorization:
            `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

  if (
    response.status === 204
  ) {
    return {
      status:
        response.status,
      data: null,
    };
  }

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.code ||
      "Zoho CRM API request failed.",
    );
  }

  return {
    status:
      response.status,
    data,
  };
}

export async function getZohoIdentity(
  apiDomain: string,
  accessToken: string,
) {
  const result =
    await zohoGet(
      apiDomain,
      accessToken,
      "/crm/v8/users?type=CurrentUser",
    );

  const user =
    Array.isArray(
      result.data?.users,
    )
      ? result.data.users[0]
      : null;

  if (!user?.id) {
    throw new Error(
      "Zoho CRM user identity could not be verified.",
    );
  }

  return {
    id:
      String(user.id),
    name:
      String(
        user.full_name ||
        user.first_name ||
        user.last_name ||
        "Zoho CRM",
      ),
    email:
      user.email
        ? String(
            user.email,
          )
        : null,
    timeZone:
      user.time_zone
        ? String(
            user.time_zone,
          )
        : null,
    zuid:
      user.zuid
        ? String(
            user.zuid,
          )
        : null,
  };
}

async function verifyModule(
  apiDomain: string,
  accessToken: string,
  module: string,
) {
  await zohoGet(
    apiDomain,
    accessToken,
    `/crm/v8/${module}?per_page=1`,
  );

  return true;
}

export async function verifyZohoCrmAccess(
  apiDomain: string,
  accessToken: string,
) {
  const [
    leadsReady,
    contactsReady,
    accountsReady,
    dealsReady,
  ] =
    await Promise.all([
      verifyModule(
        apiDomain,
        accessToken,
        "Leads",
      ),
      verifyModule(
        apiDomain,
        accessToken,
        "Contacts",
      ),
      verifyModule(
        apiDomain,
        accessToken,
        "Accounts",
      ),
      verifyModule(
        apiDomain,
        accessToken,
        "Deals",
      ),
    ]);

  return {
    leadsReady,
    contactsReady,
    accountsReady,
    dealsReady,
  };
}
