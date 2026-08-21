export type BusinessMembershipCandidate = { businessId: string };

/** Selects a business only when it is explicitly authorized. */
export function selectActiveMembership<T extends BusinessMembershipCandidate>(
  memberships: readonly T[],
  requestedBusinessId?: string | null,
): T | null {
  const requested = requestedBusinessId?.trim();
  if (requested) return memberships.find((membership) => membership.businessId === requested) ?? null;
  return memberships.length === 1 ? memberships[0] : null;
}
