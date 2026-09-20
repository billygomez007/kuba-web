import crypto from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  processMetaInboundMessage,
} from "@/lib/channels/meta/inbound";

import type {
  MetaChannel,
} from "@/lib/channels/meta/types";

function safeEqual(
  first: string,
  second: string,
) {
  const a =
    Buffer.from(first);

  const b =
    Buffer.from(second);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function verifySignature(
  rawBody: string,
  signature: string | null,
) {
  const secret =
    process.env.META_APP_SECRET;

  if (
    !secret ||
    !signature ||
    !signature.startsWith("sha256=")
  ) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        secret,
      )
      .update(rawBody)
      .digest("hex");

  return safeEqual(
    expected,
    signature,
  );
}

export async function GET(
  request: NextRequest,
) {
  const mode =
    request.nextUrl.searchParams.get(
      "hub.mode",
    );

  const token =
    request.nextUrl.searchParams.get(
      "hub.verify_token",
    );

  const challenge =
    request.nextUrl.searchParams.get(
      "hub.challenge",
    );

  const expected =
    process.env
      .META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    expected &&
    token === expected &&
    challenge
  ) {
    return new NextResponse(
      challenge,
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Webhook verification failed.",
    },
    { status: 403 },
  );
}

export async function POST(
  request: NextRequest,
) {
  const rawBody =
    await request.text();

  if (
    !verifySignature(
      rawBody,
      request.headers.get(
        "x-hub-signature-256",
      ),
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid Meta webhook signature.",
      },
      { status: 401 },
    );
  }

  let payload: any;

  try {
    payload =
      JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid webhook payload.",
      },
      { status: 400 },
    );
  }

  const channel:
    MetaChannel | null =
      payload.object === "page"
        ? "facebook_messenger"
        : payload.object === "instagram"
          ? "instagram"
          : null;

  if (!channel) {
    return NextResponse.json({
      received: true,
      ignored: true,
    });
  }

  let processed = 0;

  for (
    const entry of
    Array.isArray(payload.entry)
      ? payload.entry
      : []
  ) {
    const entryId =
      String(
        entry?.id || "",
      ).trim();

    const events =
      Array.isArray(
        entry?.messaging,
      )
        ? entry.messaging
        : [];

    for (
      const event of events
    ) {
      const message =
        event?.message;

      if (
        !message ||
        message?.is_echo
      ) {
        continue;
      }

      const senderId =
        String(
          event?.sender?.id || "",
        ).trim();

      const recipientId =
        String(
          event?.recipient?.id ||
          entryId ||
          "",
        ).trim();

      const messageId =
        String(
          message?.mid || "",
        ).trim();

      const text =
        String(
          message?.text || "",
        ).trim();

      if (
        !senderId ||
        !recipientId ||
        !messageId ||
        !text
      ) {
        continue;
      }

      const result =
        await processMetaInboundMessage({
          channel,
          externalAccountId:
            channel === "instagram"
              ? entryId ||
                recipientId
              : recipientId ||
                entryId,
          externalMessageId:
            messageId,
          senderId,
          senderName: null,
          text,
          timestamp:
            typeof event?.timestamp ===
            "number"
              ? event.timestamp
              : null,
        });

      if (
        result.status >= 200 &&
        result.status < 300
      ) {
        processed++;
      }
    }
  }

  return NextResponse.json({
    received: true,
    processed,
  });
}
