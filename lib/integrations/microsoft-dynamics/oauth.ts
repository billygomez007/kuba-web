import crypto from "crypto";

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

function stateSecret() {
  return (
    process.env.MICROSOFT_DYNAMICS_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function normalizeDynamicsEnvironmentUrl(
  input: string,
) {
  const url =
    new URL(
      input.trim(),
    );

  if (
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Dynamics environment must use HTTPS.",
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    !(
      hostname.endsWith(
        ".dynamics.com",
      ) ||
      hostname.endsWith(
        ".dynamics.cn",
      )
    )
  ) {
    throw new Error(
      "Enter a valid Microsoft Dynamics / Dataverse environment URL.",
    );
  }

  return `${url.protocol}//${hostname}`;
}

export function createDynamicsState(
  input: {
    businessId: string;
    userId: string;
    environmentUrl: string;
  },
) {
  const environmentUrl =
    normalizeDynamicsEnvironmentUrl(
      input.environmentUrl,
    );

  const payload =
    Buffer.from(
      JSON.stringify({
        businessId:
          input.businessId,
        userId:
          input.userId,
        environmentUrl,
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

export function verifyDynamicsState(
  state: string,
) {
  const [
    payload,
    signature,
  ] =
    state.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Dynamics OAuth state.",
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
      "Invalid Dynamics OAuth state signature.",
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
      environmentUrl: string;
      issuedAt: number;
      nonce: string;
    };

  if (
    !parsed.businessId ||
    !parsed.userId ||
    !parsed.environmentUrl ||
    !parsed.issuedAt ||
    Date.now() -
      parsed.issuedAt >
      15 * 60 * 1000
  ) {
    throw new Error(
      "Expired Dynamics OAuth state.",
    );
  }

  return {
    ...parsed,
    environmentUrl:
      normalizeDynamicsEnvironmentUrl(
        parsed.environmentUrl,
      ),
  };
}

function authorityBase() {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0`;
}

export function dynamicsAuthorizationUrl(
  state: string,
  environmentUrl: string,
) {
  const resource =
    normalizeDynamicsEnvironmentUrl(
      environmentUrl,
    );

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
      "MICROSOFT_DYNAMICS_REDIRECT_URI",
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
    [
      "openid",
      "profile",
      "offline_access",
      `${resource}/user_impersonation`,
    ].join(" "),
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

export async function exchangeDynamicsCode(
  code: string,
  environmentUrl: string,
) {
  const resource =
    normalizeDynamicsEnvironmentUrl(
      environmentUrl,
    );

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
                "MICROSOFT_DYNAMICS_REDIRECT_URI",
              ),
            grant_type:
              "authorization_code",
            code,
            scope:
              [
                "openid",
                "profile",
                "offline_access",
                `${resource}/user_impersonation`,
              ].join(" "),
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
      "Dynamics token exchange failed.",
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

async function dynamicsGet(
  environmentUrl: string,
  accessToken: string,
  path: string,
) {
  const base =
    normalizeDynamicsEnvironmentUrl(
      environmentUrl,
    );

  const response =
    await fetch(
      `${base}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept:
            "application/json",
          "OData-MaxVersion":
            "4.0",
          "OData-Version":
            "4.0",
        },
      },
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Dynamics Web API request failed.",
    );
  }

  return data;
}

export async function getDynamicsIdentity(
  environmentUrl: string,
  accessToken: string,
) {
  const data =
    await dynamicsGet(
      environmentUrl,
      accessToken,
      "/api/data/v9.2/WhoAmI",
    );

  if (
    !data?.UserId ||
    !data?.OrganizationId
  ) {
    throw new Error(
      "Dynamics identity could not be verified.",
    );
  }

  return {
    userId:
      String(
        data.UserId,
      ),
    businessUnitId:
      data.BusinessUnitId
        ? String(
            data.BusinessUnitId,
          )
        : null,
    organizationId:
      String(
        data.OrganizationId,
      ),
  };
}

export async function verifyDynamicsCrmAccess(
  environmentUrl: string,
  accessToken: string,
) {
  const data =
    await dynamicsGet(
      environmentUrl,
      accessToken,
      "/api/data/v9.2/",
    );

  const entitySets =
    Array.isArray(
      data?.value,
    )
      ? new Set(
          data.value
            .map(
              (
                entry:
                  Record<
                    string,
                    unknown
                  >,
              ) =>
                typeof entry.name ===
                "string"
                  ? entry.name
                  : null,
            )
            .filter(
              (
                value:
                  string | null,
              ): value is string =>
                Boolean(value),
            ),
        )
      : new Set<string>();

  return {
    accountsReady:
      entitySets.has(
        "accounts",
      ),
    contactsReady:
      entitySets.has(
        "contacts",
      ),
    opportunitiesReady:
      entitySets.has(
        "opportunities",
      ),
  };
}
