import {
  kubaReceptionistAgent,
} from "@/mastra/agents/receptionist";

import {
  kubaSalesAgent,
} from "@/mastra/agents/sales";

import {
  kubaCustomerSupportAgent,
} from "@/mastra/agents/customer-support";

import {
  kubaGeneralManagerAgent,
} from "@/mastra/agents/general-manager";

export type KubaAgentType =
  | "receptionist"
  | "sales"
  | "customer_support"
  | "general_manager";

export function getKubaAgent(
  type: string,
) {
  switch (type as KubaAgentType) {
    case "sales":
      return kubaSalesAgent;

    case "customer_support":
      return kubaCustomerSupportAgent;

    case "general_manager":
      return kubaGeneralManagerAgent;

    case "receptionist":
    default:
      return kubaReceptionistAgent;
  }
}
