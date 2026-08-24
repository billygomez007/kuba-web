import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getBusinessMembership } from "@/lib/auth/permissions";
import { activeBillingProvider, getBillingProvider } from "@/lib/billing/provider";
import { getConfiguredPriceId } from "@/lib/billing/provider";
import { saveSubscription } from "@/lib/billing/subscription-service";
import { createAuditLog } from "@/lib/auth/audit";
import { planDefinitions } from "@/lib/billing/entitlements";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const reference = new URL(request.url).searchParams.get("reference") || "";
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.redirect(`${origin}/dashboard/billing?payment=pending`);
  const membership = await getBusinessMembership(session.user.id);
  if (!membership || !reference || activeBillingProvider() !== "paystack") return NextResponse.redirect(`${origin}/dashboard/billing?payment=failed`);
  const verifier = getBillingProvider().verifyTransaction;
  if (!verifier) return NextResponse.redirect(`${origin}/dashboard/billing?payment=failed`);
  try {
    let verified = null;
    for (const candidate of planDefinitions.filter((item) => item.id === "growth" || item.id === "pro")) {
      const amount = process.env[`PAYSTACK_AMOUNT_${candidate.id.toUpperCase()}`];
      if (!amount) continue;
      try { verified = await verifier(reference, { email: session.user.email, businessId: membership.businessId, plan: candidate.id, amount, currency: process.env.SUPERKUBA_BILLING_CURRENCY || "GHS" }); break; } catch { }
    }
    if (!verified) throw new Error("Paystack transaction did not match a configured SuperKuba plan.");
    await saveSubscription(membership.businessId, verified, "paystack");
    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.payment.verified", resource: "business_subscription", description: "Paystack transaction verified by server.", metadata: { reference, plan: verified.plan } });
    return NextResponse.redirect(`${origin}/dashboard/billing?payment=verified`);
  } catch (error) {
    console.error("Paystack callback verification error:", error);
    return NextResponse.redirect(`${origin}/dashboard/billing?payment=failed`);
  }
}
