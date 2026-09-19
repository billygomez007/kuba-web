import crypto from "crypto";

const INTUIT_AUTHORIZE_URL =
  "https://appcenter.intuit.com/connect/oauth2";

const INTUIT_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const QBO_API =
  "https://quickbooks.api.intuit.com/v3/company";

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
    process.env.QUICKBOOKS_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function createQuickBooksState(
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
          crypto.randomBytes(16)
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

export function verifyQuickBooksState(
  value: string,
) {
  const [payload, signature] =
    value.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid QuickBooks OAuth state.",
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
      "Invalid QuickBooks OAuth state signature.",
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
      "Expired QuickBooks OAuth state.",
    );
  }

  return parsed;
}

export function quickBooksAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      INTUIT_AUTHORIZE_URL,
    );

  url.searchParams.set(
    "client_id",
    required(
      "QUICKBOOKS_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "QUICKBOOKS_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "scope",
    "com.intuit.quickbooks.accounting",
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

function basicAuth() {
  return (
    "Basic " +
    Buffer.from(
      `${required(
        "QUICKBOOKS_CLIENT_ID",
      )}:${required(
        "QUICKBOOKS_CLIENT_SECRET",
      )}`,
    ).toString("base64")
  );
}

export async function exchangeQuickBooksCode(
  code: string,
) {
  const response =
    await fetch(
      INTUIT_TOKEN_URL,
      {
        method:
          "POST",
        headers: {
          Authorization:
            basicAuth(),
          "Content-Type":
            "application/x-www-form-urlencoded",
          Accept:
            "application/json",
        },
        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",
            code,
            redirect_uri:
              required(
                "QUICKBOOKS_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token ||
    !data.refresh_token
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "QuickBooks token exchange failed.",
    );
  }

  return {
    accessToken:
      String(
        data.access_token,
      ),
    refreshToken:
      String(
        data.refresh_token,
      ),
    expiresIn:
      typeof data.expires_in ===
      "number"
        ? data.expires_in
        : 3600,
    refreshExpiresIn:
      typeof data.x_refresh_token_expires_in ===
      "number"
        ? data.x_refresh_token_expires_in
        : null,
    tokenType:
      data.token_type
        ? String(
            data.token_type,
          )
        : "bearer",
  };
}

async function qboGet(
  realmId: string,
  accessToken: string,
  path: string,
) {
  const response =
    await fetch(
      `${QBO_API}/${encodeURIComponent(
        realmId,
      )}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept:
            "application/json",
        },
        cache:
          "no-store",
      },
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.Fault?.Error?.[0]?.Message ||
      "QuickBooks API request failed.",
    );
  }

  return data;
}

export async function getQuickBooksCompanyInfo(
  realmId: string,
  accessToken: string,
) {
  const data =
    await qboGet(
      realmId,
      accessToken,
      `/companyinfo/${encodeURIComponent(
        realmId,
      )}`,
    );

  const company =
    data?.CompanyInfo;

  if (!company?.Id) {
    throw new Error(
      "QuickBooks company identity could not be verified.",
    );
  }

  return {
    id:
      String(
        company.Id,
      ),
    companyName:
      String(
        company.CompanyName ||
        company.LegalName ||
        "QuickBooks",
      ),
    legalName:
      company.LegalName
        ? String(
            company.LegalName,
          )
        : null,
    email:
      company.Email?.Address
        ? String(
            company.Email.Address,
          )
        : null,
    country:
      company.Country
        ? String(
            company.Country,
          )
        : null,
  };
}

async function queryEntity(
  realmId: string,
  accessToken: string,
  entity: string,
) {
  const query =
    encodeURIComponent(
      `select * from ${entity} maxresults 1`,
    );

  await qboGet(
    realmId,
    accessToken,
    `/query?query=${query}&minorversion=75`,
  );

  return true;
}

export async function verifyQuickBooksAccountingAccess(
  realmId: string,
  accessToken: string,
) {
  const [
    customersReady,
    invoicesReady,
    accountsReady,
    vendorsReady,
  ] =
    await Promise.all([
      queryEntity(
        realmId,
        accessToken,
        "Customer",
      ),
      queryEntity(
        realmId,
        accessToken,
        "Invoice",
      ),
      queryEntity(
        realmId,
        accessToken,
        "Account",
      ),
      queryEntity(
        realmId,
        accessToken,
        "Vendor",
      ),
    ]);

  return {
    customersReady,
    invoicesReady,
    accountsReady,
    vendorsReady,
  };
}
