export type BusinessMembershipCandidate = {
  businessId: string;
  role: string;
  permissions: string | null;
  branchId: string | null;
};

/**
 * Deterministic business-selection policy:
 *   1. A selectedBusinessId that matches one of the user's own memberships
 *      is always honored (this is the normal case — a real, current
 *      selection).
 *   2. A selectedBusinessId that matches NOTHING in the user's own
 *      memberships is discarded, never trusted, and never causes a
 *      different outcome than having no selection at all — this is what
 *      makes a stale cookie (an old selection left over after switching
 *      Preview deployments/environments, or a business the user no longer
 *      belongs to) safely recoverable instead of a permanent dead end. It
 *      can NEVER match another user's business: `memberships` is always
 *      pre-scoped to the authenticated user's own rows by the caller, so
 *      there is nothing here for a foreign ID to match against.
 *   3. With no (or a discarded) selection: exactly one membership is
 *      selected automatically; zero or multiple memberships resolve to
 *      null, leaving the caller to route to onboarding (zero) or an
 *      explicit business-selection UI (multiple) rather than guessing.
 */
export function selectBusinessMembership<T extends BusinessMembershipCandidate>(
  memberships: T[],
  selectedBusinessId?: string,
): T | null {
  if (selectedBusinessId) {
    const matched = memberships.find(
      (membership) => membership.businessId === selectedBusinessId,
    );
    if (matched) return matched;
  }

  return memberships.length === 1 ? memberships[0] : null;
}

export function isResourceOwnedByBusiness(
  selectedBusinessId: string,
  resourceBusinessId: string,
) {
  return selectedBusinessId === resourceBusinessId;
}
