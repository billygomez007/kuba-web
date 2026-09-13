import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businessUsers, aiEmployees } from "@/db/schema";
import { getCurrentUserOrganizations, getOrganizationBusinesses } from "@/lib/auth/organizations";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";

/**
 * Portfolio dashboard data — every organization the current user belongs
 * to, each with its linked businesses annotated with the user's OWN
 * business-level role there (or null, if they aren't a direct member —
 * portfolio linkage never implies one) and a real, safely-scoped active
 * AI employee count. Deliberately does NOT aggregate revenue, leads,
 * campaigns, or conversation totals — nothing here is fabricated; every
 * number is a real query scoped to businesses the response already lists.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same non-fatal treatment as /api/auth/me: a user with genuinely zero
  // portfolio memberships and one whose environment can't yet resolve the
  // organizations tables must look identical here — an honest empty
  // portfolio list, never a 500 for this dedicated (non-navigation-
  // blocking) page.
  let organizations: Awaited<ReturnType<typeof getCurrentUserOrganizations>> = [];
  try {
    organizations = await getCurrentUserOrganizations();
  } catch (organizationsError) {
    console.error("Portfolio lookup failed (non-fatal — an empty portfolio list is returned):", organizationsError);
    return NextResponse.json({ portfolios: [] });
  }

  const myBusinessMemberships = await db
    .select({ businessId: businessUsers.businessId, role: businessUsers.role })
    .from(businessUsers)
    .where(eq(businessUsers.userId, session.user.id));
  const myRoleByBusinessId = new Map(myBusinessMemberships.map((row) => [row.businessId, row.role]));

  const portfolios = await Promise.all(
    organizations.map(async ({ organization, role }) => {
      const linked = await getOrganizationBusinesses(organization.id);
      const businessIds = linked.map((row) => row.business.id);
      const activeEmployeeCounts = businessIds.length
        ? await db.select({ businessId: aiEmployees.businessId }).from(aiEmployees).where(and(inArray(aiEmployees.businessId, businessIds), eq(aiEmployees.status, "active")))
        : [];

      // businesses.plan is set once at creation and never updated by
      // checkout/webhook/admin-grant paths (the same reason
      // lib/billing/entitlements.ts never trusts it) — the portfolio view
      // must show each business's REAL resolved plan instead.
      const businesses = await Promise.all(
        linked.map(async (row) => ({
          id: row.business.id,
          name: row.business.name,
          plan: (await getBusinessEntitlements(row.business.id)).plan,
          status: row.business.status,
          myRole: myRoleByBusinessId.get(row.business.id) || null,
          activeEmployeeCount: activeEmployeeCounts.filter((employee) => employee.businessId === row.business.id).length,
        })),
      );

      return { organization, myOrganizationRole: role, businessCount: businesses.length, businesses };
    }),
  );

  return NextResponse.json({ portfolios });
}
