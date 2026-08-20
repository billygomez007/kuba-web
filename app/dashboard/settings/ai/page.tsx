import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiBusinessSettings,
  businessUsers,
} from "@/db/schema";

export default async function AISettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
      role: businessUsers.role,
    })
    .from(businessUsers)
    .where(eq(businessUsers.userId, session.user.id))
    .limit(1);

  const business = membership[0];

  if (!business) {
    redirect("/onboarding");
  }

  const settings = await db
    .select()
    .from(aiBusinessSettings)
    .where(
      eq(
        aiBusinessSettings.businessId,
        business.businessId,
      ),
    )
    .limit(1);

  const aiSettings = settings[0];

  const canEdit =
    business.role === "owner" ||
    business.role === "admin";

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        <div className="mb-10">
          <p className="text-sm font-medium text-violet-400">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            AI Configuration
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Teach Kuba how your business works so your AI
            employees can communicate with customers accurately
            and consistently.
          </p>
        </div>

        <form
          action="/api/businesses/ai-settings"
          method="POST"
          className="space-y-6"
        >
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              About your business
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Give Kuba a clear understanding of what your
              company does.
            </p>

            <textarea
              name="businessDescription"
              defaultValue={
                aiSettings?.businessDescription ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Tell Kuba what your business does, where you operate, and what makes your business different."
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Products & services
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Describe the products or services your AI
              employees should know about.
            </p>

            <textarea
              name="productsAndServices"
              defaultValue={
                aiSettings?.productsAndServices ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Visa assistance, study abroad admissions, flight bookings, travel consultation..."
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Target customers
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Tell Kuba who your business normally serves.
            </p>

            <textarea
              name="targetCustomers"
              defaultValue={
                aiSettings?.targetCustomers ?? ""
              }
              disabled={!canEdit}
              rows={4}
              placeholder="Example: Students, families, professionals, corporate travelers..."
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Frequently asked questions
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Add common questions and the answers Kuba should
              know.
            </p>

            <textarea
              name="frequentlyAskedQuestions"
              defaultValue={
                aiSettings?.frequentlyAskedQuestions ?? ""
              }
              disabled={!canEdit}
              rows={6}
              placeholder={`Example:

Q: Do you help with UK visas?
A: Yes. We provide visa assistance and consultation.

Q: Do you guarantee visa approval?
A: No. Visa decisions are made by the relevant authorities.`}
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              AI instructions
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Set important rules that Kuba should follow when
              representing your business.
            </p>

            <textarea
              name="aiInstructions"
              defaultValue={
                aiSettings?.aiInstructions ?? ""
              }
              disabled={!canEdit}
              rows={7}
              placeholder={`Example:

Always be professional and helpful.
Never promise visa approval.
Ask questions when information is missing.
Collect useful customer information.
Escalate complex cases to a human.`}
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Communication tone
            </h2>

            <p className="mt-1 text-sm text-white/45">
              Choose the general communication style for Kuba.
            </p>

            <select
              name="tone"
              defaultValue={
                aiSettings?.tone ?? "professional"
              }
              disabled={!canEdit}
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="professional">
                Professional
              </option>
              <option value="friendly">
                Friendly
              </option>
              <option value="formal">
                Formal
              </option>
              <option value="conversational">
                Conversational
              </option>
            </select>
          </section>

          {canEdit ? (
            <div className="flex justify-end border-t border-white/[0.08] pt-6">
              <button
                type="submit"
                className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Save AI Configuration
              </button>
            </div>
          ) : (
            <div className="border-t border-white/[0.08] pt-6 text-sm text-white/40">
              Only business owners and administrators can edit
              AI configuration.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}