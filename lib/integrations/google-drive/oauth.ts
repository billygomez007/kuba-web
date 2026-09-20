import crypto from "crypto";

const GOOGLE_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_DRIVE_API =
  "https://www.googleapis.com/drive/v3";

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
    process.env.GOOGLE_DRIVE_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    required("ENCRYPTION_KEY")
  );
}

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
];

export function createGoogleDriveState(
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

export function verifyGoogleDriveState(
  value: string,
) {
  const [
    payload,
    signature,
  ] = value.split(".");

  if (!payload || !signature) {
    throw new Error(
      "Invalid Google Drive OAuth state.",
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
      "Invalid Google Drive OAuth state signature.",
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
      "Expired Google Drive OAuth state.",
    );
  }

  return parsed;
}

export function googleDriveAuthorizationUrl(
  state: string,
) {
  const url =
    new URL(
      GOOGLE_AUTH_URL,
    );

  url.searchParams.set(
    "client_id",
    required(
      "GOOGLE_INTEGRATION_CLIENT_ID",
    ),
  );

  url.searchParams.set(
    "redirect_uri",
    required(
      "GOOGLE_DRIVE_REDIRECT_URI",
    ),
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "scope",
    scopes.join(" "),
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
    "include_granted_scopes",
    "true",
  );

  url.searchParams.set(
    "state",
    state,
  );

  return url.toString();
}

export async function exchangeGoogleDriveCode(
  code: string,
) {
  const response =
    await fetch(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          new URLSearchParams({
            code,
            client_id:
              required(
                "GOOGLE_INTEGRATION_CLIENT_ID",
              ),
            client_secret:
              required(
                "GOOGLE_INTEGRATION_CLIENT_SECRET",
              ),
            redirect_uri:
              required(
                "GOOGLE_DRIVE_REDIRECT_URI",
              ),
            grant_type:
              "authorization_code",
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
      "Google Drive token exchange failed.",
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

async function googleDriveGet(
  path: string,
  accessToken: string,
) {
  const response =
    await fetch(
      `${GOOGLE_DRIVE_API}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
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
      "Google Drive API request failed.",
    );
  }

  return data;
}

export async function getGoogleDriveIdentity(
  accessToken: string,
) {
  const data =
    await googleDriveGet(
      "/about?fields=user",
      accessToken,
    );

  const user =
    data?.user;

  if (!user) {
    throw new Error(
      "Google Drive account identity could not be verified.",
    );
  }

  return {
    displayName:
      user.displayName
        ? String(
            user.displayName,
          )
        : "Google Drive",
    email:
      user.emailAddress
        ? String(
            user.emailAddress,
          )
        : null,
    permissionId:
      user.permissionId
        ? String(
            user.permissionId,
          )
        : null,
    photoLink:
      user.photoLink
        ? String(
            user.photoLink,
          )
        : null,
  };
}

export async function listGoogleDriveFiles(
  accessToken: string,
) {
  const query =
    new URLSearchParams({
      pageSize:
        "100",
      orderBy:
        "modifiedTime desc",
      spaces:
        "drive",
      fields:
        "files(id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,parents,trashed)",
      q:
        "trashed = false",
    });

  const data =
    await googleDriveGet(
      `/files?${query.toString()}`,
      accessToken,
    );

  return Array.isArray(
    data.files,
  )
    ? data.files.map(
        (
          file:
            Record<
              string,
              unknown
            >,
        ) => ({
          id:
            String(
              file.id ||
              "",
            ),
          name:
            String(
              file.name ||
              "",
            ),
          mimeType:
            file.mimeType
              ? String(
                  file.mimeType,
                )
              : null,
          modifiedTime:
            file.modifiedTime
              ? String(
                  file.modifiedTime,
                )
              : null,
          createdTime:
            file.createdTime
              ? String(
                  file.createdTime,
                )
              : null,
          webViewLink:
            file.webViewLink
              ? String(
                  file.webViewLink,
                )
              : null,
          iconLink:
            file.iconLink
              ? String(
                  file.iconLink,
                )
              : null,
          parents:
            Array.isArray(
              file.parents,
            )
              ? file.parents.map(
                  String,
                )
              : [],
        }),
      )
    : [];
}
