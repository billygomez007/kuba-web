export type ConversationDepartment =
  | "sales"
  | "reception"
  | "customer_support"
  | "product"
  | "finance"
  | "operations"
  | "marketing"
  | "management";

export type ConversationStatus =
  | "ai_handling"
  | "waiting_for_human"
  | "human_handling"
  | "resolved"
  | "escalated";

export type AssignmentType =
  | "ai"
  | "team"
  | "user";

export type RoutingDecision = {
  department: ConversationDepartment;
  teamId: string | null;
  aiEmployeeId: string | null;
  assignedUserId: string | null;
  assignmentType: AssignmentType;
  status: ConversationStatus;
  confidence: number;
  reason: string;
};

export type RoutingContext = {
  businessId: string;
  customerId: string | null;
  conversationId: string;
  channel: string;
  message: string;
  currentDepartment: ConversationDepartment | null;
  currentTeamId: string | null;
  currentAiEmployeeId: string | null;
  currentAssignedUserId: string | null;
};

export function createRoutingDecision(
  input: Partial<RoutingDecision> &
    Pick<RoutingDecision, "department">,
): RoutingDecision {
  return {
    department: input.department,
    teamId: input.teamId ?? null,
    aiEmployeeId: input.aiEmployeeId ?? null,
    assignedUserId: input.assignedUserId ?? null,
    assignmentType: input.assignmentType ?? "ai",
    status: input.status ?? "ai_handling",
    confidence: input.confidence ?? 0,
    reason:
      input.reason ??
      "Conversation routed by Kuba.",
  };
}
