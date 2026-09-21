import { NextResponse } from "next/server";
import { requireMarketingAccess } from "@/lib/marketing/context";

import { getMarketingChannelAccounts, marketingChannelReadiness, MARKETING_SOCIAL_PROVIDERS } from "@/lib/marketing/publishing-operations";

const providers: readonly string[] = MARKETING_SOCIAL_PROVIDERS;
export async function GET() {
  const access = await requireMarketingAccess("view");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const accounts = await getMarketingChannelAccounts(access.businessId);
  const readiness = marketingChannelReadiness(accounts);

  console.log("Marketing social accounts diagnostic", {
    businessId: access.businessId,
    accountCount: accounts.length,
    accounts: accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      status: account.status,
    })),
  });

  return NextResponse.json({
    accounts,
    providers,
    readiness,
  });
}
export async function POST(request: Request) { const access = await requireMarketingAccess("manage"); if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status }); const body = await request.json().catch(() => null); const provider = typeof body?.provider === "string" ? body.provider : ""; if (!providers.includes(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 400 }); return NextResponse.json({ error: "Provider connection is not available yet.", code: "PROVIDER_NOT_CONNECTED" }, { status: 409 }); }
