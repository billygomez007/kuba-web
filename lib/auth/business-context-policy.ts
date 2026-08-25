export type BusinessMembershipCandidate = {
  businessId: string;
  role: string;
  permissions: string | null;
  branchId: string | null;
};

export function selectBusinessMembership(
  memberships: BusinessMembershipCandidate[],
  selectedBusinessId?: string,
) {
  if (selectedBusinessId) {
    return memberships.find(
      (membership) => membership.businessId === selectedBusinessId,
    ) ?? null;
  }

  return memberships.length === 1 ? memberships[0] : null;
}

export function isResourceOwnedByBusiness(
  selectedBusinessId: string,
  resourceBusinessId: string,
) {
  return selectedBusinessId === resourceBusinessId;
}
