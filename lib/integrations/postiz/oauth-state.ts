import crypto from "node:crypto";

const STATE_TTL_SECONDS = 10 * 60;

type PostizOAuthStatePayload = {
  businessId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

function stateSecret(): string {
  const secret =
    process.env.POSTIZ_OAUTH_STATE_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();

  if (!secret || secret === "[SENSITIVE]") {
    throw new Error(
      "POSTIZ_OAUTH_STATE_SECRET or BETTER_AUTH_SECRET must be configured.",
    );
  }

  return secret;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", stateSecret())
    .update(value)
    .digest("base64url");
}

export function createPostizOAuthState(
  businessId: string,
  userId: string,
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: PostizOAuthStatePayload = {
    businessId,
    userId,
    nonce: crypto.randomBytes(24).toString("base64url"),
    issuedAt: now,
    expiresAt: now + STATE_TTL_SECONDS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

export function verifyPostizOAuthState(
  state: string,
): PostizOAuthStatePayload | null {
  const [encoded, suppliedSignature, ...rest] = state.split(".");

  if (!encoded || !suppliedSignature || rest.length > 0) {
    return null;
  }

  const expectedSignature = sign(encoded);

  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as PostizOAuthStatePayload;

    if (
      !payload.businessId ||
      !payload.userId ||
      !payload.nonce ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt)
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.expiresAt < now || payload.issuedAt > now + 60) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
