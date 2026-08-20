import {
  ConversationDepartment,
  RoutingContext,
  RoutingDecision,
  createRoutingDecision,
} from "./routing";

function detectDepartment(
  message: string,
): {
  department: ConversationDepartment;
  confidence: number;
  reason: string;
} {
  const text = message
    .toLowerCase()
    .trim();

  const salesTerms = [
    "buy",
    "purchase",
    "price",
    "pricing",
    "quote",
    "quotation",
    "sales",
    "package",
    "plan",
    "cost",
    "interested",
    "order",
    "product",
    "service",
    "available",
  ];

  const receptionTerms = [
    "appointment",
    "book",
    "booking",
    "schedule",
    "visit",
    "opening hours",
    "open today",
    "location",
    "address",
    "reception",
    "come in",
  ];

  const supportTerms = [
    "problem",
    "issue",
    "help",
    "complaint",
    "not working",
    "broken",
    "refund",
    "cancel",
    "support",
    "already bought",
    "existing customer",
  ];

  const financeTerms = [
    "invoice",
    "payment",
    "paid",
    "receipt",
    "billing",
    "accounting",
    "money",
    "refund",
  ];

  const marketingTerms = [
    "advertising",
    "campaign",
    "marketing",
    "promotion",
    "social media",
    "advert",
  ];

  const matches = (
    terms: string[],
  ) =>
    terms.filter((term) =>
      text.includes(term),
    ).length;

  const scores = [
    {
      department: "sales" as const,
      score: matches(salesTerms),
      reason:
        "Message contains sales or purchase intent.",
    },
    {
      department: "reception" as const,
      score: matches(receptionTerms),
      reason:
        "Message contains reception, booking or appointment intent.",
    },
    {
      department: "customer_support" as const,
      score: matches(supportTerms),
      reason:
        "Message contains customer support or service intent.",
    },
    {
      department: "finance" as const,
      score: matches(financeTerms),
      reason:
        "Message contains payment or billing intent.",
    },
    {
      department: "marketing" as const,
      score: matches(marketingTerms),
      reason:
        "Message contains marketing intent.",
    },
  ];

  scores.sort(
    (a, b) =>
      b.score - a.score,
  );

  const best = scores[0];

  if (!best || best.score === 0) {
    return {
      department: "reception",
      confidence: 30,
      reason:
        "No clear department detected. Routed to Reception for triage.",
    };
  }

  const confidence = Math.min(
    95,
    45 + best.score * 15,
  );

  return {
    department: best.department,
    confidence,
    reason: best.reason,
  };
}

export function routeConversation(
  context: RoutingContext,
): RoutingDecision {
  const detected =
    detectDepartment(
      context.message,
    );

  return createRoutingDecision({
    department:
      detected.department,

    teamId:
      null,

    aiEmployeeId:
      null,

    assignedUserId:
      null,

    assignmentType:
      "ai",

    status:
      "ai_handling",

    confidence:
      detected.confidence,

    reason:
      detected.reason,
  });
}
