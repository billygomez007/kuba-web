import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const result = await db
    .select({
      business: businesses,
      role: businessUsers.role,
    })
    .from(businessUsers)
    .innerJoin(
      businesses,
      eq(businessUsers.businessId, businesses.id),
    )
    .where(eq(businessUsers.userId, session.user.id))
    .limit(1);

  const business = result[0]?.business;
  const role = result[0]?.role;

  if (!business) {
    redirect("/onboarding");
  }

  const canEdit =
    role === "owner" || role === "admin";

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        <div className="mb-10">
          <p className="text-sm font-medium text-violet-400">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Business Profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Manage the information Kuba uses to understand your
            business and personalize your AI employees.
          </p>
        </div>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl">
          <div className="mb-8">
            <h2 className="text-lg font-semibold">
              Business information
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Keep your business details accurate so Kuba can
              provide better customer experiences.
            </p>
          </div>

          <form
            action="/api/businesses/profile"
            method="POST"
            className="space-y-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Business name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={business.name}
                  disabled={!canEdit}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="industry"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Industry
                </label>

                <input
                  id="industry"
                  name="industry"
                  type="text"
                  defaultValue={business.industry ?? ""}
                  disabled={!canEdit}
                  placeholder="e.g. Travel & Tourism"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="country"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Country
                </label>

                <input
                  id="country"
                  name="country"
                  type="text"
                  defaultValue={business.country ?? ""}
                  disabled={!canEdit}
                  placeholder="e.g. Ghana"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="businessSize"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Business size
                </label>

                <select
                  id="businessSize"
                  name="businessSize"
                  defaultValue={business.businessSize ?? ""}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="11-50">11–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-500">201–500 employees</option>
                  <option value="501+">501+ employees</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="logoUrl"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Logo URL
              </label>

              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={business.logoUrl ?? ""}
                disabled={!canEdit}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">
              <div>
                <p className="text-sm font-medium text-white/80">
                  Account status
                </p>

                <p className="mt-1 text-xs text-white/40">
                  Your current Kuba business account status.
                </p>
              </div>

              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {business.status}
              </span>
            </div>

            {canEdit ? (
              <div className="flex justify-end border-t border-white/[0.08] pt-6">
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Save changes
                </button>
              </div>
            ) : (
              <div className="border-t border-white/[0.08] pt-6 text-sm text-white/40">
                Only business owners and administrators can edit
                business information.
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}