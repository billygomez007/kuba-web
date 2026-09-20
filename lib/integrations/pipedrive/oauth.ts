import crypto from "crypto";

const OAUTH_BASE =
  "https://oauth.pipedrive.com";

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
    process.env.PIPEDRIVE_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

export function createPipedriveState(
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

export function verifyPipedriveState(
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
      "Invalid Pipedrive OAuth state.",
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
      "Invalid Pipedrive OAuth state signature.",
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
      "Expired Pipedrive OAuth state.",
    );
  }

  return parsed;
}

export function pipedriveAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      `${OAUTH_BASE}/oauth/authorize`,
    );

  url.searchParams.set(
    "client_id",
    required(
      "PIPEDRIVE_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "PIPEDRIVE_REDIRECT_URI",
    ),
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
        "PIPEDRIVE_CLIENT_ID",
      )}:${required(
        "PIPEDRIVE_CLIENT_SECRET",
      )}`,
    ).toString("base64")
  );
}

export async function exchangePipedriveCode(
  code: string,
) {
  const response =
    await fetch(
      `${OAUTH_BASE}/oauth/token`,
      {
        method: "POST",
        headers: {
          Authorization:
            basicAuthorization(),
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",
            code,
            redirect_uri:
              required(
                "PIPEDRIVE_REDIRECT_URI",
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
      "Pipedrive token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    api_domain: string;
  };
}

async function pipedriveGet(
  apiDomain: string,
  accessToken: string,
  path: string,
) {
  const response =
    await fetch(
      `${apiDomain}${path}`,
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
    data?.success === false
  ) {
    throw new Error(
      data?.error ||
      data?.error_info ||
      "Pipedrive API request failed.",
    );
  }

  return data;
}

export async function getPipedriveIdentity(
  apiDomain: string,
  accessToken: string,
) {
  const data =
    await pipedriveGet(
      apiDomain,
      accessToken,
      "/api/v1/users/me",
    );

  const user =
    data?.data;

  if (!user?.id) {
    throw new Error(
      "Pipedrive account identity could not be verified.",
    );
  }

  return {
    id:
      String(user.id),
    name:
      user.name
        ? String(user.name)
        : "Pipedrive",
    email:
      user.email
        ? String(user.email)
        : null,
    companyId:
      user.company_id
        ? String(
            user.company_id,
          )
        : null,
    companyName:
      user.company_name
        ? String(
            user.company_name,
          )
        : null,
  };
}

export async function verifyPipedriveCrmAccess(
  apiDomain: string,
  accessToken: string,
) {
  const [
    persons,
    organizations,
    deals,
  ] =
    await Promise.all([
      pipedriveGet(
        apiDomain,
        accessToken,
        "/api/v2/persons?limit=1",
      ),
      pipedriveGet(
        apiDomain,
        accessToken,
        "/api/v2/organizations?limit=1",
      ),
      pipedriveGet(
        apiDomain,
        accessToken,
        "/api/v2/deals?limit=1",
      ),
    ]);

  return {
    personsReady:
      Array.isArray(
        persons.data,
      ),
    organizationsReady:
      Array.isArray(
        organizations.data,
      ),
    dealsReady:
      Array.isArray(
        deals.data,
      ),
  };
}
