import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { encrypt } from "@/lib/encryption";
import {
  exchangeMetaCode,
  getMetaPages,
} from "@/lib/channels/meta/graph";
import { verifyMetaOAuthState } from "@/lib/channels/meta/oauth-state";

type MetaPage = {
  id?: unknown;
  name?: unknown;
  access_token?: unknown;
  instagram_business_account?: {
    id?: unknown;
    username?: unknown;
    name?: unknown;
  } | null;
};

function stringValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function GET(
  request: Request,
) {
  const url =
    new URL(request.url);

  const code =
    url.searchParams.get("code");

  const rawState =
    url.searchParams.get("state");

  const providerError =
    url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=denied",
        url.origin,
      ),
    );
  }

  if (!code || !rawState) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=invalid",
        url.origin,
      ),
    );
  }

  const state =
    verifyMetaOAuthState(
      rawState,
    );

  if (!state) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=invalid-state",
        url.origin,
      ),
    );
  }

  try {
    const userAccessToken =
      await exchangeMetaCode(code);

    const pages =
      (await getMetaPages(
        userAccessToken,
      )) as MetaPage[];

    let discovered = 0;

    for (const page of pages) {
      const pageId =
        stringValue(page.id);

      const pageName =
        stringValue(page.name);

      const pageAccessToken =
        stringValue(
          page.access_token,
        );

      if (
        !pageId ||
        !pageAccessToken
      ) {
        continue;
      }

      if (
        state.channel ===
        "facebook_messenger"
      ) {
        const existing =
          (
            await db
              .select({
                id: integrations.id,
              })
              .from(integrations)
              .where(
                and(
                  eq(
                    integrations.businessId,
                    state.businessId,
                  ),
                  eq(
                    integrations.provider,
                    "meta",
                  ),
                  eq(
                    integrations.externalAccountId,
                    pageId,
                  ),
                ),
              )
              .limit(1)
          )[0];

        const metadata =
          JSON.stringify({
            channel:
              "facebook_messenger",
            pageId,
            pageName:
              pageName || null,
            graphApiVersion:
              process.env
                .META_GRAPH_API_VERSION ||
              "v25.0",
          });

        if (existing) {
          await db
            .update(integrations)
            .set({
              displayName:
                pageName ||
                "Facebook Page",
              credentialsEncrypted:
                encrypt(
                  pageAccessToken,
                ),
              metadata,
              status: "pending",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(
                  integrations.id,
                  existing.id,
                ),
                eq(
                  integrations.businessId,
                  state.businessId,
                ),
              ),
            );
        } else {
          await db
            .insert(integrations)
            .values({
              id:
                crypto.randomUUID(),
              businessId:
                state.businessId,
              provider: "meta",
              status: "pending",
              externalAccountId:
                pageId,
              externalPhoneNumberId:
                null,
              displayName:
                pageName ||
                "Facebook Page",
              credentialsEncrypted:
                encrypt(
                  pageAccessToken,
                ),
              metadata,
              lastWebhookAt: null,
              createdAt:
                new Date(),
              updatedAt:
                new Date(),
            });
        }

        discovered++;
      }

      if (
        state.channel ===
        "instagram"
      ) {
        const instagram =
          page.instagram_business_account;

        const instagramId =
          stringValue(
            instagram?.id,
          );

        if (!instagramId) {
          continue;
        }

        const username =
          stringValue(
            instagram?.username,
          );

        const instagramName =
          stringValue(
            instagram?.name,
          );

        const existing =
          (
            await db
              .select({
                id: integrations.id,
              })
              .from(integrations)
              .where(
                and(
                  eq(
                    integrations.businessId,
                    state.businessId,
                  ),
                  eq(
                    integrations.provider,
                    "meta",
                  ),
                  eq(
                    integrations.externalAccountId,
                    instagramId,
                  ),
                ),
              )
              .limit(1)
          )[0];

        const metadata =
          JSON.stringify({
            channel:
              "instagram",
            pageId,
            pageName:
              pageName || null,
            instagramAccountId:
              instagramId,
            instagramUsername:
              username || null,
            graphApiVersion:
              process.env
                .META_GRAPH_API_VERSION ||
              "v25.0",
          });

        if (existing) {
          await db
            .update(integrations)
            .set({
              displayName:
                username ||
                instagramName ||
                pageName ||
                "Instagram",
              credentialsEncrypted:
                encrypt(
                  pageAccessToken,
                ),
              metadata,
              status: "pending",
              updatedAt:
                new Date(),
            })
            .where(
              and(
                eq(
                  integrations.id,
                  existing.id,
                ),
                eq(
                  integrations.businessId,
                  state.businessId,
                ),
              ),
            );
        } else {
          await db
            .insert(integrations)
            .values({
              id:
                crypto.randomUUID(),
              businessId:
                state.businessId,
              provider: "meta",
              status: "pending",
              externalAccountId:
                instagramId,
              externalPhoneNumberId:
                null,
              displayName:
                username ||
                instagramName ||
                pageName ||
                "Instagram",
              credentialsEncrypted:
                encrypt(
                  pageAccessToken,
                ),
              metadata,
              lastWebhookAt: null,
              createdAt:
                new Date(),
              updatedAt:
                new Date(),
            });
        }

        discovered++;
      }
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations/meta?status=discovered&count=${discovered}`,
        url.origin,
      ),
    );
  } catch (error) {
    console.error(
      "Meta OAuth discovery failed.",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=error",
        url.origin,
      ),
    );
  }
}
