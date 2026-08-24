import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { partnerOrganizations, partnerProducts, partnerProductVersions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
export async function GET() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!await isPlatformAdmin(session.user.id)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 }); const rows = await db.select({ product: partnerProducts, partnerName: partnerOrganizations.name, version: partnerProductVersions.version }).from(partnerProducts).innerJoin(partnerOrganizations, eq(partnerProducts.partnerId, partnerOrganizations.id)).leftJoin(partnerProductVersions, eq(partnerProductVersions.productId, partnerProducts.id)); return NextResponse.json({ reviews: rows }); }
