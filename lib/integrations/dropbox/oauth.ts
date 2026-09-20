import crypto from "crypto";

const DROPBOX_AUTHORIZE_URL =
  "https://www.dropbox.com/oauth2/authorize";

const DROPBOX_TOKEN_URL =
  "https://api.dropboxapi.com/oauth2/token";

const DROPBOX_API =
  "https://api.dropboxapi.com/2";

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
    process.env.DROPBOX_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

const scopes = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
];

export function createDropboxState(
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

export function verifyDropboxState(
  value: string,
) {
  const [
    payload,
    signature,
  ] = value.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Dropbox OAuth state.",
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
      "Invalid Dropbox OAuth state signature.",
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
      "Expired Dropbox OAuth state.",
    );
  }

  return parsed;
}

export function dropboxAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      DROPBOX_AUTHORIZE_URL,
    );

  url.searchParams.set(
    "client_id",
    required(
      "DROPBOX_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "DROPBOX_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "token_access_type",
    "offline",
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

function basicAuthorization() {
  return (
    "Basic " +
    Buffer.from(
      `${required(
        "DROPBOX_CLIENT_ID",
      )}:${required(
        "DROPBOX_CLIENT_SECRET",
      )}`,
    ).toString("base64")
  );
}

export async function exchangeDropboxCode(
  code: string,
) {
  const response =
    await fetch(
      DROPBOX_TOKEN_URL,
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
            code,
            grant_type:
              "authorization_code",
            redirect_uri:
              required(
                "DROPBOX_REDIRECT_URI",
              ),
          }),
      },
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token ||
    !data.account_id
  ) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Dropbox token exchange failed.",
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
        : null,
    tokenType:
      data.token_type
        ? String(
            data.token_type,
          )
        : "bearer",
    scope:
      data.scope
        ? String(
            data.scope,
          )
        : "",
    accountId:
      String(
        data.account_id,
      ),
    uid:
      data.uid
        ? String(
            data.uid,
          )
        : null,
  };
}

async function dropboxPost(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const response =
    await fetch(
      `${DROPBOX_API}${path}`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            body,
          ),
      },
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error_summary ||
      data?.error?.[".tag"] ||
      "Dropbox API request failed.",
    );
  }

  return data;
}

export async function getDropboxIdentity(
  accessToken: string,
) {
  const account =
    await dropboxPost(
      "/users/get_current_account",
      accessToken,
      {},
    );

  if (!account?.account_id) {
    throw new Error(
      "Dropbox account identity could not be verified.",
    );
  }

  return {
    accountId:
      String(
        account.account_id,
      ),
    displayName:
      String(
        account.name?.display_name ||
        account.email ||
        "Dropbox",
      ),
    email:
      account.email
        ? String(
            account.email,
          )
        : null,
    emailVerified:
      Boolean(
        account.email_verified,
      ),
    profilePhotoUrl:
      account.profile_photo_url
        ? String(
            account.profile_photo_url,
          )
        : null,
    accountType:
      account.account_type?.[".tag"]
        ? String(
            account.account_type[".tag"],
          )
        : null,
  };
}

export async function listDropboxFiles(
  accessToken: string,
) {
  const first =
    await dropboxPost(
      "/files/list_folder",
      accessToken,
      {
        path: "",
        recursive: false,
        include_deleted: false,
        include_non_downloadable_files: true,
        limit: 100,
      },
    );

  const entries:
    Record<string, unknown>[] =
      Array.isArray(
        first?.entries,
      )
        ? [
            ...first.entries,
          ]
        : [];

  let cursor =
    typeof first?.cursor ===
    "string"
      ? first.cursor
      : null;

  let hasMore =
    Boolean(
      first?.has_more,
    );

  let pages = 1;

  while (
    hasMore &&
    cursor &&
    pages < 3
  ) {
    const next =
      await dropboxPost(
        "/files/list_folder/continue",
        accessToken,
        {
          cursor,
        },
      );

    if (
      Array.isArray(
        next?.entries,
      )
    ) {
      entries.push(
        ...next.entries,
      );
    }

    cursor =
      typeof next?.cursor ===
      "string"
        ? next.cursor
        : null;

    hasMore =
      Boolean(
        next?.has_more,
      );

    pages += 1;
  }

  return entries
    .filter(
      (
        entry,
      ) =>
        entry?.[".tag"] ===
          "file" ||
        entry?.[".tag"] ===
          "folder",
    )
    .map(
      (
        entry,
      ) => ({
        type:
          String(
            entry[".tag"] ||
            "",
          ),
        id:
          entry.id
            ? String(
                entry.id,
              )
            : null,
        name:
          String(
            entry.name ||
            "",
          ),
        pathLower:
          entry.path_lower
            ? String(
                entry.path_lower,
              )
            : null,
        pathDisplay:
          entry.path_display
            ? String(
                entry.path_display,
              )
            : null,
        clientModified:
          entry.client_modified
            ? String(
                entry.client_modified,
              )
            : null,
        serverModified:
          entry.server_modified
            ? String(
                entry.server_modified,
              )
            : null,
        size:
          typeof entry.size ===
          "number"
            ? entry.size
            : null,
      }),
    );
}
