import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, organizationMembers, organizationBusinesses, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { createAuditLog } from "@/lib/auth/audit";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!await isPlatformAdmin(session.user.id)) return { error: NextResponse.json({ error: "Platform admin access required." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const [orgs, members, links] = await Promise.all([
    db.select().from(organizations),
    db.select().from(organizationMembers),
    db.select().from(organizationBusinesses),
  ]);

  const rows = orgs.map((org) => ({
    ...org,
    memberCount: members.filter((member) => member.organizationId === org.id).length,
    businessCount: links.filter((link) => link.organizationId === org.id).length,
  }));

  return NextResponse.json({ organizations: rows });
}

/**
 * Creates a new portfolio and, if an owner is supplied, adds them as its
 * first "owner" member in the same call — the one-shot path for setting up
 * a new Realtegic-style portfolio. Organization creation is platform-admin
 * only for now (not self-serve) — this is oversight/grouping metadata for
 * businesses this platform's operator explicitly manages, not a customer-
 * facing feature yet.
 */
export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : "";

  if (!name) return NextResponse.json({ error: "A portfolio name is required." }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  let ownerUserId: string | null = null;
  if (ownerEmail) {
    const owner = (await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
    if (!owner) return NextResponse.json({ error: `No user found for ${ownerEmail}. They must sign up first.` }, { status: 404 });
    ownerUserId = owner.id;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + crypto.randomUUID().slice(0, 8);
  const organizationId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({ id: organizationId, name, slug, createdAt: now, updatedAt: now });
    if (ownerUserId) {
      await tx.insert(organizationMembers).values({ id: crypto.randomUUID(), organizationId, userId: ownerUserId, role: "owner", createdAt: now });
    }
  });

  await createAuditLog({
    businessId: "platform",
    userId: access.session.user.id,
    action: "admin.organization.created",
    resource: "organization",
    resourceId: organizationId,
    description: reason,
    metadata: { name, ownerEmail: ownerEmail || null },
  });

  return NextResponse.json({ success: true, organizationId }, { status: 201 });
}
