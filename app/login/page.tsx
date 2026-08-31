import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import LoginClient from "./LoginClient";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    token?: string | string[];
  }>;
};

function safeRelativePath(
  value: string | string[] | undefined,
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/dashboard";
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeRelativePath(
    params.callbackUrl,
  );
  const invitationToken =
    typeof params.token === "string"
      ? params.token
      : "";
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <LoginClient
      callbackUrl={callbackUrl}
      invitationToken={invitationToken}
    />
  );
}
