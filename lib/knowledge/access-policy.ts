export type KnowledgeSourceScope = {
  businessId: string;
  employeeId: string | null;
};

export function canUseKnowledgeSource(
  selectedBusinessId: string,
  source: KnowledgeSourceScope,
  employeeId?: string,
) {
  if (source.businessId !== selectedBusinessId) return false;
  return !employeeId || source.employeeId === null || source.employeeId === employeeId;
}
