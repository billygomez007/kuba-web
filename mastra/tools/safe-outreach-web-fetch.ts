import { createTool, webFetchTool } from "@mastra/core/tools";
import { z } from "zod";

const OUTREACH_MAX_CONTENT_CHARS = 10_000;

type WebFetchResult = {
  content: string;
  truncated?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  url?: string;
  ok?: boolean;
  isError?: boolean;
};

function isWebFetchResult(value: unknown): value is WebFetchResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    typeof (value as { content?: unknown }).content === "string"
  );
}

export const safeOutreachWebFetchTool = createTool({
  id: "safe-outreach-web-fetch",

  description:
    "Fetch a public HTTP or HTTPS page for Outreach research using Mastra's protected web fetch, then return a compact result suitable for AI research.",

  inputSchema: z.object({
    url: z
      .string()
      .min(1)
      .describe("The fully qualified public HTTP or HTTPS URL to fetch."),
  }),

  execute: async ({ url }, context) => {
    const execute = webFetchTool.execute;

    if (!execute) {
      return {
        content: "Web fetch is currently unavailable.",
        isError: true,
        truncated: false,
        outreachContentLimit: OUTREACH_MAX_CONTENT_CHARS,
      };
    }

    const rawResult = await execute(
      { url },
      context as never,
    );

    if (!isWebFetchResult(rawResult)) {
      return {
        content: "The web page could not be fetched.",
        isError: true,
        truncated: false,
        outreachContentLimit: OUTREACH_MAX_CONTENT_CHARS,
      };
    }

    const exceededOutreachLimit =
      rawResult.content.length > OUTREACH_MAX_CONTENT_CHARS;

    return {
      ...rawResult,
      content: exceededOutreachLimit
        ? rawResult.content.slice(0, OUTREACH_MAX_CONTENT_CHARS)
        : rawResult.content,
      truncated:
        Boolean(rawResult.truncated) ||
        exceededOutreachLimit,
      outreachContentLimit: OUTREACH_MAX_CONTENT_CHARS,
    };
  },
});
