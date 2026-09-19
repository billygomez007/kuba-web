import crypto from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  encrypt,
} from "@/lib/encryption";
import {
  exchangeQuickBooksCode,
  getQuickBooksCompanyInfo,
  verifyQuickBooksAccountingAccess,
  verifyQuickBooksState,
} from "@/lib/integrations/quickbooks/oauth";

export async function GET(
  request: NextRequest,
) {
  const code =
    request.nextUrl.searchParams.get(
      "code",
    );

  const state =
    request.nextUrl.searchParams.get(
      "state",
    );

  const realmId =
    request.nextUrl.searchParams.get(
      "realmId",
    );

  const providerError =
    request.nextUrl.searchParams.get(
      "error",
    );

  const destination =
    new URL(
      "/dashboard/integrations/accounting",
      request.url,
    );

  if (providerError) {
    destination.searchParams.set(
      "quickbooks",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (
    !code ||
    !state ||
    !realmId
  ) {
    destination.searchParams.set(
      "quickbooks",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyQuickBooksState(
        state,
      );

    const tokens =
      await exchangeQuickBooksCode(
        code,
      );

    const company =
      await getQuickBooksCompanyInfo(
        realmId,
        tokens.accessToken,
      );

    const readiness =
      await verifyQuickBooksAccountingAccess(
        realmId,
        tokens.accessToken,
      );

    if (
      !readiness.customersReady ||
      !readiness.invoicesReady ||
      !readiness.accountsReady ||
      !readiness.vendorsReady
    ) {
      throw new Error(
        "QuickBooks accounting access could not be verified.",
      );
    }

    const existing =
      (
        await db
          .select({
            id:
              integrations.id,
          })
          .from(
            integrations,
          )
          .where(
            and(
              eq(
                integrations.businessId,
                verified.businessId,
              ),
              eq(
                integrations.provider,
                "quickbooks",
              ),
            ),
          )
          .limit(1)
      )[0];

    const credentials =
      encrypt(
        JSON.stringify({
          accessToken:
            tokens.accessToken,
          refreshToken:
            tokens.refreshToken,
          expiresAt:
            Date.now() +
            tokens.expiresIn *
              1000,
          refreshExpiresAt:
            tokens.refreshExpiresIn
              ? Date.now() +
                tokens.refreshExpiresIn *
                  1000
              : null,
          tokenType:
            tokens.tokenType,
          realmId,
        }),
      );

    const metadata =
      JSON.stringify({
        realmId,
        companyName:
          company.companyName,
        legalName:
          company.legalName,
        email:
          company.email,
        country:
          company.country,
        readiness,
      });

    const now =
      new Date();

    if (existing) {
      await db
        .update(
          integrations,
        )
        .set({
          status:
            "active",
          externalAccountId:
            realmId,
          displayName:
            company.companyName,
          credentialsEncrypted:
            credentials,
          metadata,
          updatedAt:
            now,
        })
        .where(
          and(
            eq(
              integrations.id,
              existing.id,
            ),
            eq(
              integrations.businessId,
              verified.businessId,
            ),
          ),
        );
    } else {
      await db
        .insert(
          integrations,
        )
        .values({
          id:
            crypto.randomUUID(),
          businessId:
            verified.businessId,
          provider:
            "quickbooks",
          status:
            "active",
          externalAccountId:
            realmId,
          displayName:
            company.companyName,
          credentialsEncrypted:
            credentials,
          metadata,
          createdAt:
            now,
          updatedAt:
            now,
        });
    }

    destination.searchParams.set(
      "quickbooks",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "QuickBooks OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "quickbooks",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
