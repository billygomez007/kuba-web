export type WorkforceMembership = {
  businessId: string;
  role: string;
  permissions: string | null;
};

export function ownsWorkforceResource(
  membershipBusinessId: string,
  resourceBusinessId: string,
) {
  return Boolean(membershipBusinessId) && membershipBusinessId === resourceBusinessId;
}

export function filterWorkforceResources<T extends { businessId: string }>(
  rows: T[],
  businessId: string,
) {
  return rows.filter((row) => ownsWorkforceResource(businessId, row.businessId));
}

export function canViewPayroll(role: string, effectivePermissions: string[]) {
  return (
    ["owner", "admin", "accountant"].includes(role) &&
    effectivePermissions.includes("accounting.view")
  );
}

export function resolveSelectedWorkforceBusiness(
  memberships: WorkforceMembership[],
  selectedBusinessId: string | null | undefined,
) {
  if (!selectedBusinessId) return null;
  return memberships.find((item) => item.businessId === selectedBusinessId) ?? null;
}

