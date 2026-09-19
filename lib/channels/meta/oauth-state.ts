import crypto from "node:crypto";

import type { MetaChannel } from "./types";

type MetaOAuthState = {
  businessId: string;
  channel: MetaChannel;
  nonce: string;
  issuedAt: number;
};

const MAX_STATE_AGE_MS = 15 * 60 * 1000;

function getSecret() {
  const value =
    process.env.META_OAUTH_STATE_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim();

  if (!value) {
    throw new Error(
      "META_OAUTH_STATE_SECRET or ENCRYPTION_KEY must be configured.",
    );
  }

  return value;
}

function sign(payload: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createMetaOAuthState(
  businessId: string,
  channel: MetaChannel,
) {
  const state: MetaOAuthState = {
    businessId,
    channel,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  const payload = Buffer.from(
    JSON.stringify(state),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyMetaOAuthState(
  value: string,
): MetaOAuthState | null {
  const [payload, signature] =
    value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);

  const expectedBuffer =
    Buffer.from(expected);

  const receivedBuffer =
    Buffer.from(signature);

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return null;
  }

  if (
    !crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer,
    )
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        payload,
        "base64url",
      ).toString("utf8"),
    ) as MetaOAuthState;

    if (
      !parsed.businessId ||
      (
        parsed.channel !== "facebook_messenger" &&
        parsed.channel !== "instagram"
      ) ||
      !parsed.nonce ||
      !parsed.issuedAt
    ) {
      return null;
    }

    if (
      Date.now() - parsed.issuedAt >
      MAX_STATE_AGE_MS
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
