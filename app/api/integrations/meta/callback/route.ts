import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=denied",
        url.origin,
      ),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations/meta?status=invalid",
        url.origin,
      ),
    );
  }

  /*
   * OAuth exchange, account discovery, token encryption,
   * subscription and persistence will be implemented in
   * the next pass after Meta app credentials and callback
   * configuration are verified.
   *
   * Do not mark an integration connected until that
   * provider verification succeeds.
   */

  return NextResponse.redirect(
    new URL(
      "/dashboard/integrations/meta?status=pending-verification",
      url.origin,
    ),
  );
}
