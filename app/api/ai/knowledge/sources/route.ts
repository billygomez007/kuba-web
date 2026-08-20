import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessUsers,
  knowledgeSources,
  knowledgeChunks,
} from "@/db/schema";


async function getBusinessId() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return {
      session,
      businessId: null,
    };
  }

  const membership =
    await db
      .select({
        businessId:
          businessUsers.businessId,
      })
      .from(businessUsers)
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);

  return {
    session,
    businessId:
      membership[0]?.businessId || null,
  };
}


export async function GET() {
  try {
    const {
      session,
      businessId,
    } = await getBusinessId();

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

    if (!businessId) {
      return NextResponse.json(
        {
          error: "Business not found",
        },
        {
          status: 404,
        },
      );
    }

    const sources =
      await db
        .select()
        .from(knowledgeSources)
        .where(
          eq(
            knowledgeSources.businessId,
            businessId,
          ),
        )
        .orderBy(
          knowledgeSources.createdAt,
        );

    return NextResponse.json({
      success: true,
      sources,
    });

  } catch (error) {
    console.error(
      "Knowledge sources GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load knowledge sources.",
      },
      {
        status: 500,
      },
    );
  }
}


export async function DELETE(
  request: Request,
) {
  try {
    const {
      session,
      businessId,
    } = await getBusinessId();

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

    if (!businessId) {
      return NextResponse.json(
        {
          error: "Business not found",
        },
        {
          status: 404,
        },
      );
    }

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
              businessId,
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

    await db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(
            knowledgeChunks.sourceId,
            sourceId,
          ),
          eq(
            knowledgeChunks.businessId,
            businessId,
          ),
        ),
      );

    await db
      .delete(knowledgeSources)
      .where(
        and(
          eq(
            knowledgeSources.id,
            sourceId,
          ),
          eq(
            knowledgeSources.businessId,
            businessId,
          ),
        ),
      );

    const storagePath =
      path.join(
        process.cwd(),
        "storage",
        "knowledge",
        source.storageKey,
      );

    try {
      await unlink(storagePath);
    } catch (error) {
      console.warn(
        "Knowledge file could not be removed:",
        error,
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(
      "Knowledge source DELETE error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to delete knowledge source.",
      },
      {
        status: 500,
      },
    );
  }
}
