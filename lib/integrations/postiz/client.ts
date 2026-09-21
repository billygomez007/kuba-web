import { decrypt } from "@/lib/encryption";

export const POSTIZ_PROVIDER = "postiz";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value || value === "[SENSITIVE]") {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getPostizConfig() {
  return {
    clientId: requiredEnv("POSTIZ_CLIENT_ID"),
    clientSecret: requiredEnv("POSTIZ_CLIENT_SECRET"),
    baseUrl: requiredEnv("POSTIZ_BASE_URL").replace(/\/+$/, ""),
    apiUrl: requiredEnv("POSTIZ_API_URL").replace(/\/+$/, ""),
  };
}

export type PostizTokenResponse = {
  access_token?: string;
  accessToken?: string;
  token_type?: string;
  tokenType?: string;
  scope?: string;
  expires_in?: number;
  expiresIn?: number;
  refresh_token?: string;
  refreshToken?: string;
  [key: string]: unknown;
};

export type PostizIntegration = {
  id?: string;
  identifier?: string;
  provider?: string;
  name?: string;
  displayName?: string;
  handle?: string;
  picture?: string;
  disabled?: boolean;
  [key: string]: unknown;
};

export async function exchangePostizAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<PostizTokenResponse> {
  const config = getPostizConfig();

  const response = await fetch(`${config.apiUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as PostizTokenResponse & {
    error?: unknown;
    message?: unknown;
  };

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "Postiz authorization-code exchange failed.";

    throw new Error(message);
  }

  return payload;
}

export function getPostizAccessToken(
  credentialsEncrypted: string | null | undefined,
): string {
  if (!credentialsEncrypted) {
    throw new Error("Postiz credentials are not available.");
  }

  const decrypted = decrypt(credentialsEncrypted);

  try {
    const parsed = JSON.parse(decrypted) as PostizTokenResponse;
    const token = parsed.access_token ?? parsed.accessToken;

    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  } catch {
    if (decrypted.trim()) {
      return decrypted.trim();
    }
  }

  throw new Error("Postiz access token is unavailable.");
}

export async function listPostizIntegrations(
  accessToken: string,
): Promise<PostizIntegration[]> {
  const config = getPostizConfig();

  const response = await fetch(`${config.apiUrl}/public/v1/integrations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | PostizIntegration[]
    | {
        integrations?: PostizIntegration[];
        data?: PostizIntegration[];
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && !Array.isArray(payload) && typeof payload.message === "string"
        ? payload.message
        : "Postiz integrations could not be loaded.",
    );
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.integrations)) {
    return payload.integrations;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}
