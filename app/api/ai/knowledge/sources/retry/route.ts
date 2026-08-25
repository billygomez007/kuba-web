import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";

import {
  knowledgeSources,
} from "@/db/schema";

import {
  ingestKnowledgeSource,
} from "@/lib/knowledge/ingest";


export async function POST(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        {
          error: "Business not found",
        },
        {
          status: 404,
        },
      );
    }
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.KNOWLEDGE_MANAGE)) return NextResponse.json({ error: "Knowledge management access denied." }, { status: 403 });

    const body =
      await request.json();

    const sourceId =
      String(
        body.sourceId || "",
      ).trim();

    if (!sourceId) {
      return NextResponse.json(
        {
          error:
            "sourceId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const sourceResult =
      await db
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(
              knowledgeSources.id,
              sourceId,
            ),
            eq(
              knowledgeSources.businessId,
              business.businessId,
            ),
          ),
        )
        .limit(1);

    const source =
      sourceResult[0];

    if (!source) {
      return NextResponse.json(
        {
          error:
            "Knowledge source not found.",
        },
        {
          status: 404,
        },
      );
    }

    const storagePath =
      path.join(
        process.cwd(),
        "storage",
        "knowledge",
        source.storageKey,
      );

    let buffer: Buffer;

    try {
      buffer =
        await readFile(
          storagePath,
        );
    } catch (error) {
      console.error(
        "Knowledge retry file read error:",
        error,
      );

      await db
        .update(knowledgeSources)
        .set({
          status: "failed",
          processingError:
            "The original knowledge file could not be found.",
          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              knowledgeSources.id,
              sourceId,
            ),
            eq(
              knowledgeSources.businessId,
              business.businessId,
            ),
          ),
        );

      return NextResponse.json(
        {
          error:
            "The original knowledge file could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const result =
      await ingestKnowledgeSource(
        sourceId,
        buffer,
      );

    await createAuditLog({ businessId: business.businessId, userId: session.user.id, action: "business_brain.source.retried", resource: "knowledge_source", resourceId: sourceId, description: `Retried processing for ${source.originalName}.`, metadata: { chunks: result.chunks } });

    return NextResponse.json({
      success: true,
      chunks:
        result.chunks,
    });

  } catch (error) {
    console.error(
      "Knowledge source retry error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to retry knowledge processing.",
      },
      {
        status: 500,
      },
    );
  }
}
