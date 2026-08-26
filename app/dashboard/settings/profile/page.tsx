import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";

export default async function BusinessProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const membership = await getCurrentMembership();
  const business = membership
    ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
    : undefined;

  if (!membership || !business) {
    redirect("/onboarding");
  }

  const canEdit =
    membership.role === "owner" ||
    membership.role === "admin";

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-[140px]" />
      </div>

      <div className="relative">
        <header className="border-b border-white/[0.07] bg-[#07070A]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-8">
            <div>
              <a
                href="/dashboard"
                className="text-sm font-medium text-white/40 hover:text-white"
              >
                ← Back to dashboard
              </a>

              <h1 className="mt-4 text-3xl font-black tracking-tight">
                Business Profile
              </h1>

              <p className="mt-2 text-sm text-white/40">
                Manage the information customers and Kuba use
                to understand your business.
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1200px] px-6 py-10 lg:px-8 lg:py-12">
          <form
            action="/api/businesses/profile"
            method="POST"
            className="space-y-6"
          >
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl font-black">
                  {business.name
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
                    Business identity
                  </p>

                  <h2 className="mt-2 text-xl font-black">
                    {business.name}
                  </h2>

                  <p className="mt-1 text-sm text-white/35">
                    Your business information
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
                Company information
              </p>

              <h2 className="mt-2 text-xl font-black">
                Tell Kuba about your company
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  label="Business name"
                  name="name"
                  defaultValue={business.name}
                  disabled={!canEdit}
                />

                <Field
                  label="Country"
                  name="country"
                  defaultValue={business.country ?? ""}
                  disabled={!canEdit}
                />

                <Field
                  label="Industry"
                  name="industry"
                  defaultValue={business.industry ?? ""}
                  disabled={!canEdit}
                />

                <Field
                  label="Business size"
                  name="businessSize"
                  defaultValue={
                    business.businessSize ?? ""
                  }
                  disabled={!canEdit}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                Business identity
              </p>

              <h2 className="mt-2 text-xl font-black">
                Public-facing details
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/40">
                These details will eventually be available to
                your AI employees when representing your business.
              </p>

              <div className="mt-6">
                <label className="block">
                  <span className="text-sm font-semibold text-white/70">
                    Logo URL
                  </span>

                  <input
                    name="logoUrl"
                    defaultValue={
                      business.logoUrl ?? ""
                    }
                    disabled={!canEdit}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                Account
              </p>

              <h2 className="mt-2 text-xl font-black">
                Account information
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <ReadOnlyField
                  label="Plan"
                  value={business.plan}
                />

                <ReadOnlyField
                  label="Account status"
                  value={business.status}
                />
              </div>
            </section>

            {canEdit ? (
              <div className="flex justify-end border-t border-white/[0.08] pt-6">
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
                >
                  Save Business Profile
                </button>
              </div>
            ) : (
              <div className="border-t border-white/[0.08] pt-6 text-sm text-white/40">
                Only business owners and administrators can
                edit the business profile.
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-white/70">
        {label}
      </span>

      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-white/70">
        {label}
      </p>

      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm capitalize text-white/50">
        {value}
      </div>
    </div>
  );
}