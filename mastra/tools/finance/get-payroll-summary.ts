import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { payrollRuns } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

/**
 * Payroll is the only real, structured financial-record data this platform
 * stores for a business's own money (payroll runs already go through a
 * prepare/approve/finalize workflow with its own authorization — see
 * payrollRuns' check constraints). There is no invoices/transactions/
 * receivables/payables schema, so Accountant and Finance both share this one
 * honest read tool rather than either fabricating numbers for domains that
 * don't exist yet. Amounts are stored in minor units (cents); this tool
 * converts to major units for readability.
 */
export const getPayrollSummaryTool = createTool({
  id: "get-payroll-summary",

  description:
    "Retrieve real payroll run totals (gross, tax, deductions, net) for the current business, most recent first. Returns an honest empty result if no payroll runs exist yet. This is the only financial-record data available — there is no invoicing, revenue, or bank-transaction data connected.",

  inputSchema: z.object({
    limit: z.number().int().min(1).max(24).optional().describe("How many recent payroll runs to return. Defaults to 6."),
  }),

  execute: async ({ limit }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_payroll_summary" });
    if (!decision.ok) return { available: false, runs: [], message: decision.message };

    const rows = await db
      .select({
        id: payrollRuns.id,
        runNumber: payrollRuns.runNumber,
        status: payrollRuns.status,
        currencyCode: payrollRuns.currencyCode,
        employeeCount: payrollRuns.employeeCount,
        grossAmountMinor: payrollRuns.grossAmountMinor,
        taxAmountMinor: payrollRuns.taxAmountMinor,
        deductionAmountMinor: payrollRuns.deductionAmountMinor,
        netAmountMinor: payrollRuns.netAmountMinor,
        finalizedAt: payrollRuns.finalizedAt,
        createdAt: payrollRuns.createdAt,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.businessId, businessId))
      .orderBy(desc(payrollRuns.createdAt))
      .limit(limit ?? 6);

    if (rows.length === 0) {
      return {
        available: false,
        runs: [],
        message: "No payroll runs exist for this business yet. There is no other financial-record data (invoicing, revenue, transactions) connected.",
      };
    }

    return {
      available: true,
      runs: rows.map((run) => ({
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        currencyCode: run.currencyCode,
        employeeCount: run.employeeCount,
        grossAmount: run.grossAmountMinor / 100,
        taxAmount: run.taxAmountMinor / 100,
        deductionAmount: run.deductionAmountMinor / 100,
        netAmount: run.netAmountMinor / 100,
        finalizedAt: run.finalizedAt,
        createdAt: run.createdAt,
      })),
      note: "Payroll is the only structured financial-record data connected. There is no invoicing, revenue, receivables/payables, or bank-transaction data — do not estimate those.",
    };
  },
});
