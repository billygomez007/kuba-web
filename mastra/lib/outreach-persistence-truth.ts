/*
 * Deterministic persistence-truth backstop for Kuba Outreach's conversational
 * chat path (kubaOutreachAgent.generate() in app/api/ai/outreach/route.ts).
 *
 * That chat agent has direct persistence tools (save/qualify/promote) for
 * interactive use, and composes its own final-text summary of what it did.
 * A Preview incident showed that summary cannot be trusted on its own: the
 * model narrated "I called the tool to save BVM... Result: (Assuming
 * success.)" for tools it never actually invoked, and nothing in the code
 * path caught it before that text reached the user.
 *
 * This module never trusts the model's prose. It reads the actual
 * `toolResults` Mastra returns from `agent.generate()` (`FullOutput.toolResults`,
 * see node_modules/@mastra/core/dist/stream/base/output.d.ts and
 * node_modules/@mastra/core/dist/stream/types.d.ts — each entry's
 * `payload` carries `toolName` and the tool's own genuine return value).
 * Every persistence tool in mastra/tools/save-outreach-*.ts,
 * qualify-outreach-prospect.ts, and promote-outreach-prospect-to-sales.ts
 * returns `{ success: boolean, ... }` — that is the only source of truth
 * this module uses for whether a persistent action actually happened.
 *
 * If the model's text hedges about tool success, or claims success for an
 * action the ledger cannot confirm, the whole response is replaced with a
 * safe, ledger-based summary rather than trying to patch individual
 * sentences in the model's prose.
 */

export const PERSISTENCE_ACTION_TOOLS = [
  "saveOutreachProspect",
  "saveOutreachEvidence",
  "saveOutreachContact",
  "qualifyOutreachProspect",
  "promoteOutreachProspectToSales",
] as const;

export type PersistenceActionTool =
  (typeof PERSISTENCE_ACTION_TOOLS)[number];

const PERSISTENCE_ACTION_TOOL_SET: ReadonlySet<string> = new Set(
  PERSISTENCE_ACTION_TOOLS,
);

/*
 * Structural subset of Mastra's real `ToolResultChunk`
 * (@mastra/core dist/stream/types.d.ts: `{ type: "tool-result", payload:
 * ToolResultPayload }`, where `ToolResultPayload` carries `toolCallId`,
 * `toolName`, `result`, and an optional `isError`). Declared narrowly here,
 * not imported, so this module stays dependency-free and independently
 * testable — the real chunk type satisfies this shape structurally.
 */
export type ToolResultLike = {
  payload: {
    toolName: string;
    result: unknown;
    isError?: boolean;
  };
};

export type ActionOutcome = {
  invoked: boolean;
  confirmed: boolean;
  result: unknown;
};

export type PersistenceLedger = Record<
  PersistenceActionTool,
  ActionOutcome
>;

function isConfirmedSuccess(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { success?: unknown }).success === true
  );
}

/**
 * Builds the ground-truth ledger of what actually happened this turn, from
 * the real tool results Mastra returned — never from the model's text.
 */
export function buildPersistenceLedger(
  toolResults: ToolResultLike[] | undefined,
): PersistenceLedger {
  const ledger = Object.fromEntries(
    PERSISTENCE_ACTION_TOOLS.map((tool) => [
      tool,
      { invoked: false, confirmed: false, result: undefined },
    ]),
  ) as PersistenceLedger;

  for (const entry of toolResults ?? []) {
    const name = entry?.payload?.toolName;

    if (!name || !PERSISTENCE_ACTION_TOOL_SET.has(name)) {
      continue;
    }

    const tool = name as PersistenceActionTool;
    const result = entry.payload.result;
    const confirmed =
      !entry.payload.isError && isConfirmedSuccess(result);

    // A tool can legitimately be called more than once in a turn (e.g. two
    // save-evidence calls). Once any call for this tool is confirmed, stay
    // confirmed even if a later call for the same tool fails.
    ledger[tool] = {
      invoked: true,
      confirmed: ledger[tool].confirmed || confirmed,
      result,
    };
  }

  return ledger;
}

const ACTION_LABELS: Record<PersistenceActionTool, string> = {
  saveOutreachProspect: "Prospect save",
  saveOutreachEvidence: "Evidence save",
  saveOutreachContact: "Contact save",
  qualifyOutreachProspect: "Qualification",
  promoteOutreachProspectToSales: "Sales promotion",
};

/*
 * Per-action phrasing the model tends to use when narrating that a specific
 * persistence step happened. Matched independently of the ledger so an
 * unconfirmed claim can be attributed to the right action when building the
 * safe fallback message. This is intentionally scoped to these five known
 * actions — it is not a general classifier of arbitrary chat text.
 */
const ACTION_CLAIM_PATTERNS: Record<
  PersistenceActionTool,
  RegExp[]
> = {
  saveOutreachProspect: [
    /prospect[\s\S]{0,30}saved/i,
    /saved[\s\S]{0,30}prospect/i,
    /save prospect/i,
  ],
  saveOutreachEvidence: [
    /evidence[\s\S]{0,30}saved/i,
    /saved[\s\S]{0,30}evidence/i,
    /save[\s\S]{0,10}evidence/i,
  ],
  saveOutreachContact: [
    /contact[\s\S]{0,30}saved/i,
    /saved[\s\S]{0,30}contact/i,
    /save[\s\S]{0,10}contact/i,
  ],
  qualifyOutreachProspect: [
    /qualification[\s\S]{0,30}saved/i,
    /saved[\s\S]{0,20}qualification/i,
    /marked as (?:qualified|nurture|disqualified)/i,
  ],
  promoteOutreachProspectToSales: [
    /promoted to sales/i,
    /sales lead created/i,
    /handed off to sales/i,
  ],
};

/*
 * Hedge phrases that are, on their own, an admission the model does not
 * actually know whether a tool succeeded (this is the exact family of
 * phrasing observed in the confirmed BVM Preview failure). Their presence
 * anywhere in the text is unsafe to show verbatim, regardless of which
 * action they are attached to.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /assuming success/i,
  /assumed success/i,
  /result:\s*\(?\s*assuming/i,
  /should (?:be|have been) saved/i,
  /should (?:be|have been) persisted/i,
  /appears (?:to (?:be|have been) )?saved/i,
  /appears (?:to (?:be|have been) )?persisted/i,
  /presumably saved/i,
  /presumably persisted/i,
  /likely saved/i,
  /likely persisted/i,
  /exact tool response not shown/i,
  // A fabricated illustrative example standing in for a real returned
  // value (e.g. "ICP Fit Score: (e.g. 60 out of 100, reasonable
  // inference...)") — this is invention, not a report of a real result,
  // even when a real tool call happened elsewhere in the same turn.
  /\(\s*e\.g\.,?\s*\d/i,
  /\(\s*example[,:]?\s*\d/i,
  /reasonable inference based on/i,
];

function containsHedgeLanguage(text: string): boolean {
  return HEDGE_PATTERNS.some((pattern) => pattern.test(text));
}

function findUnconfirmedClaimedActions(
  text: string,
  ledger: PersistenceLedger,
): PersistenceActionTool[] {
  return PERSISTENCE_ACTION_TOOLS.filter((tool) => {
    const claimed = ACTION_CLAIM_PATTERNS[tool].some((pattern) =>
      pattern.test(text),
    );

    return claimed && !ledger[tool].confirmed;
  });
}

function extractConfirmedId(
  tool: PersistenceActionTool,
  result: unknown,
): string | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }

  const value = result as Record<string, unknown>;
  const nestedKey =
    tool === "saveOutreachProspect"
      ? "prospect"
      : tool === "saveOutreachEvidence"
        ? "evidence"
        : tool === "saveOutreachContact"
          ? "contact"
          : null;

  if (nestedKey) {
    const nested = value[nestedKey];

    if (typeof nested === "object" && nested !== null) {
      const id = (nested as Record<string, unknown>).id;
      return typeof id === "string" ? id : null;
    }

    return null;
  }

  if (tool === "qualifyOutreachProspect") {
    const prospect = value.prospect;

    if (typeof prospect === "object" && prospect !== null) {
      const id = (prospect as Record<string, unknown>).id;
      return typeof id === "string" ? id : null;
    }
  }

  return null;
}

function buildSafeFallbackText(ledger: PersistenceLedger): string {
  const lines = [
    "Research was completed, but the assistant's own description of what it saved could not be verified against the actual tool results, so here is what is actually confirmed:",
  ];

  for (const tool of PERSISTENCE_ACTION_TOOLS) {
    const outcome = ledger[tool];
    const label = ACTION_LABELS[tool];

    if (!outcome.invoked) {
      lines.push(
        `- ${label}: not confirmed — this action was not actually performed.`,
      );
      continue;
    }

    if (outcome.confirmed) {
      const id = extractConfirmedId(tool, outcome.result);
      lines.push(
        `- ${label}: confirmed${id ? ` (id: ${id})` : ""}.`,
      );
      continue;
    }

    const errorMessage =
      typeof outcome.result === "object" &&
      outcome.result !== null &&
      typeof (outcome.result as Record<string, unknown>).error ===
        "string"
        ? (outcome.result as Record<string, unknown>).error
        : "the tool did not report success";

    lines.push(`- ${label}: not confirmed — ${errorMessage}.`);
  }

  lines.push(
    "No email, WhatsApp, SMS, or other external message was sent as part of this research.",
  );

  return lines.join("\n");
}

export type PersistenceTruthReason =
  | "hedge_language"
  | "unconfirmed_claim"
  | null;

export type PersistenceTruthEnforcement = {
  text: string;
  overridden: boolean;
  reason: PersistenceTruthReason;
  ledger: PersistenceLedger;
};

/**
 * The only function the chat path should trust for final response text.
 * Never returns the model's raw text unchanged when that text hedges about
 * tool success, or claims success for a persistence action the actual tool
 * results cannot confirm — regardless of why the model produced that text
 * (including truncation from hitting the output-token budget).
 */
export function enforcePersistenceTruth({
  text,
  toolResults,
}: {
  text: string;
  toolResults: ToolResultLike[] | undefined;
}): PersistenceTruthEnforcement {
  const ledger = buildPersistenceLedger(toolResults);

  if (containsHedgeLanguage(text)) {
    return {
      text: buildSafeFallbackText(ledger),
      overridden: true,
      reason: "hedge_language",
      ledger,
    };
  }

  const unconfirmedClaims = findUnconfirmedClaimedActions(
    text,
    ledger,
  );

  if (unconfirmedClaims.length > 0) {
    return {
      text: buildSafeFallbackText(ledger),
      overridden: true,
      reason: "unconfirmed_claim",
      ledger,
    };
  }

  return { text, overridden: false, reason: null, ledger };
}
