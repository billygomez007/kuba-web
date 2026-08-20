import { and, eq, like, or, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  knowledgeChunks,
  knowledgeSources,
} from "@/db/schema";


export type KnowledgeSearchResult = {
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
  content: string;
};


export async function searchKnowledge(
  businessId: string,
  query: string,
  limit = 8,
  employeeId?: string,
): Promise<KnowledgeSearchResult[]> {

  const cleanedQuery =
    query.trim();

  if (!cleanedQuery) {
    return [];
  }


  const words =
    cleanedQuery
      .toLowerCase()
      .split(/\s+/)
      .map((word) =>
        word.replace(
          /[^a-z0-9]/g,
          "",
        ),
      )
      .filter(
        (word) =>
          word.length >= 3,
      )
      .slice(0, 8);


  if (words.length === 0) {
    return [];
  }


  const rows =
    await db
      .select({
        sourceId:
          knowledgeChunks.sourceId,

        sourceName:
          knowledgeSources.originalName,

        chunkIndex:
          knowledgeChunks.chunkIndex,

        content:
          knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeSources,
        eq(
          knowledgeSources.id,
          knowledgeChunks.sourceId,
        ),
      )
      .where(
        and(
          eq(
            knowledgeChunks.businessId,
            businessId,
          ),

          eq(
            knowledgeSources.status,
            "ready",
          ),

          ...(employeeId
            ? [
                or(
                  eq(
                    knowledgeSources.employeeId,
                    employeeId,
                  ),
                  isNull(
                    knowledgeSources.employeeId,
                  ),
                ),
              ]
            : []),
        ),
      );


  const scored =
    rows
      .map((row) => {

        const content =
          row.content.toLowerCase();

        let score = 0;

        for (const word of words) {
          if (
            content.includes(word)
          ) {
            score += 1;
          }
        }

        const phrase =
          cleanedQuery.toLowerCase();

        if (
          content.includes(
            phrase,
          )
        ) {
          score += 5;
        }

        return {
          row,
          score,
        };
      })
      .filter(
        (item) =>
          item.score > 0,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .slice(0, limit);


  return scored.map(
    ({ row }) => ({
      sourceId:
        row.sourceId,

      sourceName:
        row.sourceName,

      chunkIndex:
        row.chunkIndex,

      content:
        row.content,
    }),
  );
}
