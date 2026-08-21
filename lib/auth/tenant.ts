import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { AuthorizationError, requireBusinessContext } from "@/lib/auth/authorization";

export async function getCurrentUser() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function getCurrentMembership(request?: Request) {
  try {
    return (await requireBusinessContext(request)).membership;
  } catch {
    return null;
  }
}

export async function requireBusinessMembership(request?: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, membership: null, error: "Unauthorized" } as const;
  }

  try {
    const context = await requireBusinessContext(request);
    return { user: context.user, membership: context.membership, error: null } as const;
  } catch (error) {
    const authorizationError = error instanceof AuthorizationError ? error : null;
    return {
      user,
      membership: null,
      error: authorizationError?.message || "Business access denied.",
    } as const;
  }
}

export function isSameBusiness(
  membershipBusinessId: string,
  resourceBusinessId: string,
) {
  return (
    membershipBusinessId ===
    resourceBusinessId
  );
}
