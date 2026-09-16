import { getCustomerCrmContextTool, findLeadsTool, findDealsTool, getDealTool, listCrmPipelinesTool, listCrmStagesTool } from "@/mastra/tools/crm-tools";
export type CrmEmployeeType = "receptionist" | "customer-support" | "outreach" | "operations" | "general-manager" | "appointment" | "marketing" | "accountant" | "finance" | "hr" | "sales" | "custom";
const reads = { getCustomerCrmContext: getCustomerCrmContextTool, findLeads: findLeadsTool, findDeals: findDealsTool, getDeal: getDealTool, listCrmPipelines: listCrmPipelinesTool, listCrmStages: listCrmStagesTool };
export function crmToolsForEmployeeType(type: CrmEmployeeType): Record<string, unknown> {
 switch (type) {
  case "sales": return reads;
  case "receptionist": case "customer-support": case "appointment": return { getCustomerCrmContext: reads.getCustomerCrmContext, getDeal: reads.getDeal };
  case "outreach": return { getCustomerCrmContext: reads.getCustomerCrmContext, findLeads: reads.findLeads, findDeals: reads.findDeals };
  case "operations": return { getCustomerCrmContext: reads.getCustomerCrmContext, getDeal: reads.getDeal, findDeals: reads.findDeals };
  case "general-manager": return { findDeals: reads.findDeals, listCrmPipelines: reads.listCrmPipelines, listCrmStages: reads.listCrmStages };
  case "marketing": return { findLeads: reads.findLeads, findDeals: reads.findDeals };
  case "accountant": case "finance": return { getCustomerCrmContext: reads.getCustomerCrmContext, getDeal: reads.getDeal };
  case "hr": case "custom": return {};
 }
}
export const CRM_TOOL_POLICY = Object.freeze({ receptionist: ["getCustomerCrmContext", "getDeal"], "customer-support": ["getCustomerCrmContext", "getDeal"], outreach: ["getCustomerCrmContext", "findLeads", "findDeals"], operations: ["getCustomerCrmContext", "getDeal", "findDeals"], "general-manager": ["findDeals", "listCrmPipelines", "listCrmStages"], appointment: ["getCustomerCrmContext", "getDeal"], marketing: ["findLeads", "findDeals"], accountant: ["getCustomerCrmContext", "getDeal"], finance: ["getCustomerCrmContext", "getDeal"], hr: [], custom: [] });
