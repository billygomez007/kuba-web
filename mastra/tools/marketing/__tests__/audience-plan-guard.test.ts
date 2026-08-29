import { describe, it, expect } from "vitest";

import { findSensitiveSegments } from "@/mastra/tools/marketing/create-audience-plan";

describe("findSensitiveSegments", () => {
  it("allows lawful segments built from business data", () => {
    const segments = [
      { name: "Inactive leads", definition: "Leads with stage new/contacted and no update in 14+ days", rationale: "Re-engagement opportunity" },
      { name: "Repeat customers", definition: "Customers with more than one order", rationale: "Loyalty and referral candidates" },
    ];
    expect(findSensitiveSegments(segments)).toEqual([]);
  });

  it("flags a segment that references a protected characteristic", () => {
    const segments = [
      { name: "Targeted group", definition: "Customers of a specific religion", rationale: "Assumed higher interest" },
    ];
    const flagged = findSensitiveSegments(segments);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].name).toBe("Targeted group");
  });

  it("flags sensitive terms in the rationale even if the definition looks neutral", () => {
    const segments = [
      { name: "High value", definition: "Customers by spend", rationale: "Correlated with sexual orientation in our data" },
    ];
    expect(findSensitiveSegments(segments)).toHaveLength(1);
  });
});
