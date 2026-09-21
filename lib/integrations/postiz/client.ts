import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { decrypt, encrypt } from "@/lib/encryption";

const PROVIDER = "postiz";
const STATE_TTL_SECONDS = 10 * 60;

type PostizStatePayload = {
  businessId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
};

export type PostizAccount = {
  id: string;
  provider: string;
  name: string | null;
  handle: string | null;
  picture: string | null;
  raw: Record<string, unknown>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
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

function stateSecret(): string {
  /*
   * Do not introduce another production secret if the application already
   * has a strong server-only encryption key. The Postiz OAuth state is
   * authenticated with that existing secret.
   */
  return requiredEnv("ENCRYPTION_KEY");
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signStatePayload(encodedPayload: string): string {
  return createHmac("sha256", stateSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createPostizOAuthState(input: {
  businessId: string;
  userId: string;
}): string {
  const payload: PostizStatePayload = {
    businessId: input.businessId,
    userId: input.userId,
    nonce: randomBytes(24).toString("base64url"),
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const encodedPayload = encode(JSON.stringify(payload));
  const signature = signStatePayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyPostizOAuthState(state: string): PostizStatePayload | null {
  const [encodedPayload, providedSignature, ...rest] = state.split(".");

  if (!encodedPayload || !providedSignature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signStatePayload(encodedPayload);

  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as PostizStatePayload;

    if (
      !payload.businessId ||
      !payload.userId ||
      !payload.nonce ||
      !Number.isFinite(payload.issuedAt)
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (
      payload.issuedAt > now + 60 ||
      now - payload.issuedAt > STATE_TTL_SECONDS
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getPostizRedirectUri(): string {
  const configured = process.env.POSTIZ_REDIRECT_URI?.trim();

  if (configured) {
    return configured;
  }

  return "https://www.superkuba.com/api/integrations/postiz/callback";
}

export function buildPostizAuthorizationUrl(state: string): string {
  const config = getPostizConfig();

  const url = new URL("/oauth/authorize", config.baseUrl);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getPostizRedirectUri());
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangePostizCode(code: string): Promise<string> {
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
      redirect_uri: getPostizRedirectUri(),
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | {
        access_token?: unknown;
        error?: unknown;
        message?: unknown;
      }
    | null;

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : `Postiz token exchange failed with HTTP ${response.status}.`,
    );
  }

  if (!data || typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Postiz did not return an access token.");
  }

  return data.access_token;
}

export function encryptPostizCredential(accessToken: string): string {
  return encrypt(
    JSON.stringify({
      accessToken,
      provider: PROVIDER,
    }),
  );
}

export function decryptPostizCredential(value: string): string {
  const parsed = JSON.parse(decrypt(value)) as {
    accessToken?: unknown;
    provider?: unknown;
  };

  if (
    parsed.provider !== PROVIDER ||
    typeof parsed.accessToken !== "string" ||
    !parsed.accessToken
  ) {
    throw new Error("Stored Postiz credentials are invalid.");
  }

  return parsed.accessToken;
}

function normalizePostizAccount(
  value: unknown,
): PostizAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const idCandidate =
    raw.id ??
    raw.integrationId ??
    raw.integration_id ??
    raw.identifier;

  if (
    typeof idCandidate !== "string" &&
    typeof idCandidate !== "number"
  ) {
    return null;
  }

  const providerCandidate =
    raw.provider ??
    raw.type ??
    raw.platform ??
    raw.identifier;

  const nameCandidate =
    raw.name ??
    raw.displayName ??
    raw.display_name ??
    raw.username;

  const handleCandidate =
    raw.handle ??
    raw.username ??
    raw.userName;

  const pictureCandidate =
    raw.picture ??
    raw.pictureUrl ??
    raw.picture_url ??
    raw.avatar;

  return {
    id: String(idCandidate),
    provider:
      typeof providerCandidate === "string"
        ? providerCandidate
        : "unknown",
    name:
      typeof nameCandidate === "string"
        ? nameCandidate
        : null,
    handle:
      typeof handleCandidate === "string"
        ? handleCandidate
        : null,
    picture:
      typeof pictureCandidate === "string"
        ? pictureCandidate
        : null,
    raw,
  };
}

export async function listPostizAccounts(
  accessToken: string,
): Promise<PostizAccount[]> {
  const config = getPostizConfig();

  const response = await fetch(
    `${config.apiUrl}/public/v1/integrations`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      `Postiz integrations request failed with HTTP ${response.status}.`,
    );
  }

  const candidates = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as Record<string, unknown>).integrations)
      ? ((payload as Record<string, unknown>).integrations as unknown[])
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

  return candidates
    .map(normalizePostizAccount)
    .filter((account): account is PostizAccount => account !== null);
}

export const POSTIZ_PROVIDER = PROVIDER;
