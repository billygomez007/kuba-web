import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  knowledgeSources,
  knowledgeChunks,
} from "@/db/schema";

import { processKnowledgeFile } from "./processor";
import { chunkKnowledgeText } from "./chunker";


export async function ingestKnowledgeSource(
  sourceId: string,
  buffer: Buffer,
  businessId: string,
): Promise<{
  chunks: number;
}> {

  const sourceResult =
    await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.businessId, businessId),
        ),
      )
      .limit(1);

  const source =
    sourceResult[0];

  if (!source) {
    throw new Error(
      "Knowledge source not found.",
    );
  }


  await db
    .update(knowledgeSources)
    .set({
      status: "processing",
      processingError: null,
      updatedAt: new Date(),
    })
    .where(
      eq(
        knowledgeSources.id,
        sourceId,
      ),
    );


  try {

    const processed =
      await processKnowledgeFile(
        buffer,
        source.fileType,
        source.mimeType,
      );


    const chunks =
      chunkKnowledgeText(
        processed.text,
      );


    if (chunks.length === 0) {
      throw new Error(
        "No readable knowledge was found in this file.",
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
            source.businessId,
          ),
        ),
      );


    await db
      .insert(knowledgeChunks)
      .values(
        chunks.map(
          (content, index) => ({
            id:
              crypto.randomUUID(),

            businessId:
              source.businessId,

            sourceId:
              source.id,

            chunkIndex:
              index,

            content,

            createdAt:
              new Date(),
          }),
        ),
      );


    await db
      .update(knowledgeSources)
      .set({
        status: "ready",
        processingError: null,
        updatedAt: new Date(),
      })
      .where(
        eq(
          knowledgeSources.id,
          sourceId,
        ),
      );


    return {
      chunks: chunks.length,
    };

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : "Unknown processing error.";


    await db
      .update(knowledgeSources)
      .set({
        status: "failed",
        processingError: message,
        updatedAt: new Date(),
      })
      .where(
        eq(
          knowledgeSources.id,
          sourceId,
        ),
      );


    throw error;
  }
}
