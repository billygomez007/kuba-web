import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { partnerOrganizations, partnerProducts, partnerProductVersions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

async function partner() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }; const org = (await db.select().from(partnerOrganizations).where(eq(partnerOrganizations.contactEmail, session.user.email)).limit(1))[0]; if (!org || org.marketplaceStatus !== "verified") return { error: NextResponse.json({ error: "Verified partner access required." }, { status: 403 }) }; return { session, org }; }
export async function GET() { const value = await partner(); if (value.error) return value.error; const products = await db.select().from(partnerProducts).where(eq(partnerProducts.partnerId, value.org.id)); return NextResponse.json({ products }); }
export async function POST(request: Request) { const value = await partner(); if (value.error) return value.error; const body = await request.json(); const name = typeof body.name === "string" ? body.name.trim() : ""; const type = typeof body.type === "string" ? body.type : ""; const description = typeof body.description === "string" ? body.description.trim() : ""; if (!name || !["AI Employee", "Skill", "Automation", "Package", "Integration"].includes(type) || !description) return NextResponse.json({ error: "Valid name, type, and description are required." }, { status: 400 }); const id = crypto.randomUUID(); await db.insert(partnerProducts).values({ id, partnerId: value.org.id, name, type, description, status: "draft", verified: false, createdAt: new Date(), updatedAt: new Date() }); await db.insert(partnerProductVersions).values({ id: crypto.randomUUID(), productId: id, version: "1.0.0", releaseNotes: "Initial draft", manifest: JSON.stringify({ capabilities: body.capabilities || [], permissions: body.permissions || [], integrations: body.integrations || [], pricing: body.pricing || "Free" }), status: "draft", createdAt: new Date() }); return NextResponse.json({ success: true, id }, { status: 201 }); }
