/**
 * Inbound email content is untrusted third-party input. No HTML
 * sanitization library exists yet in this codebase (no sanitize-html,
 * DOMPurify, etc.), and adding one correctly — getting an allowlist right —
 * is a real security decision, not something to rush inside a broader
 * feature pass. Per Phase 11's own instruction ("Prefer safe text
 * rendering unless sanitized HTML is already supported properly"), this
 * module extracts plain, safe text only. It never stores or renders raw
 * HTML.
 *
 * This is also what makes tracking pixels and remote-image loading a
 * non-issue by construction: plain text extraction never fetches or
 * embeds any remote resource. Malicious-link *detection* (phishing/malware
 * scanning) is explicitly out of scope for this pass — links survive only
 * as inert plain text.
 */

const SCRIPT_OR_STYLE_RE = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const BLOCK_TAG_RE = /<\/(p|div|br|tr|li|h[1-6])>/gi;
const TAG_RE = /<[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const codePoint = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(codePoint) && codePoint > 0) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

/** Converts inbound HTML to plain, safe text — no tags, no scripts/styles, entities decoded. */
export function htmlToSafeText(html: string): string {
  const withoutScriptsAndStyles = html.replace(SCRIPT_OR_STYLE_RE, "");
  const withNewlines = withoutScriptsAndStyles.replace(BLOCK_TAG_RE, "\n");
  const withoutTags = withNewlines.replace(TAG_RE, "");
  const decoded = decodeEntities(withoutTags);
  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Common reply-quote patterns across major mail clients: "On <date>, <name>
 * wrote:", ">"-prefixed quote blocks, and Outlook's "-----Original
 * Message-----" / "From: ... Sent: ... To: ... Subject:" block. Trims the
 * text at the FIRST such marker — the sender's own new content always
 * comes before it. Never fabricates a marker that isn't there; text with
 * no quote pattern is returned unchanged. The quoted history itself is
 * intentionally discarded rather than stored again: it is a repeat of a
 * message SuperKuba already has its own row for earlier in the same
 * conversation.
 */
const QUOTE_MARKERS: RegExp[] = [
  /^On .{0,80} wrote:\s*$/im,
  /^>.*$/m,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^From:.{0,200}\nSent:.{0,200}\nTo:/im,
];

export function trimQuotedReply(text: string): { content: string; quotedContentTrimmed: boolean } {
  let earliestIndex: number | null = null;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text);
    if (match && (earliestIndex === null || match.index < earliestIndex)) {
      earliestIndex = match.index;
    }
  }
  if (earliestIndex === null) {
    return { content: text.trim(), quotedContentTrimmed: false };
  }
  const trimmed = text.slice(0, earliestIndex).trim();
  // A marker at (or near) the very start means there is no real new content
  // above the quote — keep the original text rather than returning an
  // empty message.
  return trimmed
    ? { content: trimmed, quotedContentTrimmed: true }
    : { content: text.trim(), quotedContentTrimmed: false };
}

export interface SanitizedEmailBody {
  content: string;
  quotedContentTrimmed: boolean;
  sourceFormat: "text" | "html";
}

/**
 * Prefers the provider-supplied plain-text part when available (no HTML
 * parsing needed at all); falls back to extracting safe text from HTML
 * only when no text part exists.
 */
export function sanitizeInboundEmailBody(params: { text?: string | null; html?: string | null }): SanitizedEmailBody {
  const rawText = params.text?.trim();
  if (rawText) {
    const { content, quotedContentTrimmed } = trimQuotedReply(rawText);
    return { content, quotedContentTrimmed, sourceFormat: "text" };
  }
  const html = params.html?.trim();
  if (html) {
    const asText = htmlToSafeText(html);
    const { content, quotedContentTrimmed } = trimQuotedReply(asText);
    return { content, quotedContentTrimmed, sourceFormat: "html" };
  }
  return { content: "", quotedContentTrimmed: false, sourceFormat: "text" };
}
