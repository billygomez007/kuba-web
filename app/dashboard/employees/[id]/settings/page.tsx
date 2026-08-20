import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiEmployees,
  aiEmployeeSettings,
  businessUsers,
  users,
} from "@/db/schema";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeeSettingsPage({
  params,
}: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

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

  const employeeResult = await db
    .select({
      employee: aiEmployees,
    })
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.id, id),
        eq(
          aiEmployees.businessId,
          business.businessId,
        ),
      ),
    )
    .limit(1);

  const employee = employeeResult[0]?.employee;

  if (!employee) {
    notFound();
  }

  const settingsResult = await db
    .select()
    .from(aiEmployeeSettings)
    .where(
      eq(
        aiEmployeeSettings.employeeId,
        employee.id,
      ),
    )
    .limit(1);

  const settings = settingsResult[0];

  const supervisors = await db
    .select({
      userId: users.id,
      name: users.name,
      role: businessUsers.role,
    })
    .from(businessUsers)
    .innerJoin(
      users,
      eq(
        users.id,
        businessUsers.userId,
      ),
    )
    .where(
      eq(
        businessUsers.businessId,
        business.businessId,
      ),
    );

  const canEdit =
    business.role === "owner" ||
    business.role === "admin";

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        <div className="mb-8">
          <a
            href={`/dashboard/employees/${employee.id}`}
            className="text-sm text-white/40 transition hover:text-white"
          >
            ← Back to {employee.name}
          </a>

          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              AI Employee Settings
            </p>

            <h1 className="mt-2 text-3xl font-black">
              {employee.name}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
              Configure how this AI employee behaves,
              communicates, and handles business tasks.
            </p>
          </div>
        </div>

        <form
          action="/api/ai-employees/settings"
          method="POST"
          className="space-y-6"
        >
          <input
            type="hidden"
            name="employeeId"
            value={employee.id}
          />

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              AI Supervision
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Choose who supervises this AI employee.
            </p>

            <div className="mt-5 space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="radio"
                  name="supervisionMode"
                  value="owner_supervised"
                  defaultChecked={
                    employee.supervisionMode === "owner_supervised"
                  }
                  disabled={!canEdit}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Owner supervised
                  </span>
                  <span className="text-xs text-white/40">
                    The business owner manages this AI employee.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="radio"
                  name="supervisionMode"
                  value="human_supervised"
                  defaultChecked={
                    employee.supervisionMode === "human_supervised"
                  }
                  disabled={!canEdit}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Human supervised
                  </span>
                  <span className="text-xs text-white/40">
                    Assign a team member to supervise this AI employee.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="radio"
                  name="supervisionMode"
                  value="autonomous"
                  defaultChecked={
                    employee.supervisionMode === "autonomous"
                  }
                  disabled={!canEdit}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Autonomous
                  </span>
                  <span className="text-xs text-white/40">
                    Kuba operates without a human supervisor.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold">
                Supervisor
              </label>

              <select
                name="supervisorUserId"
                defaultValue={employee.supervisorUserId ?? ""}
                disabled={!canEdit}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
              >
                <option value="">
                  Select supervisor
                </option>

                {supervisors.map((person) => (
                  <option
                    key={person.userId}
                    value={person.userId}
                  >
                    {person.name} ({person.role})
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Role instructions
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Tell Kuba exactly how this employee should perform
              its role.
            </p>

            <textarea
              name="roleInstructions"
              defaultValue={
                settings?.roleInstructions ?? ""
              }
              disabled={!canEdit}
              rows={6}
              placeholder="Example: Welcome customers, understand their needs, answer common questions, and route qualified opportunities to Kuba Sales."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Goals
            </h2>

            <p className="mt-2 text-sm text-white/40">
              What should this employee try to accomplish?
            </p>

            <textarea
              name="goals"
              defaultValue={settings?.goals ?? ""}
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Provide excellent first-contact support, qualify customer opportunities, and increase successful handoffs to Sales."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Responsibilities
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Define the work this employee is responsible for.
            </p>

            <textarea
              name="responsibilities"
              defaultValue={
                settings?.responsibilities ?? ""
              }
              disabled={!canEdit}
              rows={6}
              placeholder="Example: Answer customer questions, capture customer information, identify customer needs, create qualified leads, and escalate complex cases."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Personality
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Describe the personality this employee should
              have when communicating with customers.
            </p>

            <textarea
              name="personality"
              defaultValue={
                settings?.personality ?? ""
              }
              disabled={!canEdit}
              rows={4}
              placeholder="Example: Warm, patient, professional, confident and genuinely helpful."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Communication style
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Tell Kuba how this employee should communicate.
            </p>

            <textarea
              name="communicationStyle"
              defaultValue={
                settings?.communicationStyle ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Use clear, concise language. Keep messages natural and easy to understand. Avoid unnecessary technical language."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Information to collect
            </h2>

            <p className="mt-2 text-sm text-white/40">
              What information should this employee collect from
              customers?
            </p>

            <textarea
              name="informationToCollect"
              defaultValue={
                settings?.informationToCollect ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Customer name, phone number, email, destination, travel purpose, preferred travel date, and service of interest."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Escalation rules
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Define situations where the AI should stop and
              involve a human.
            </p>

            <textarea
              name="escalationRules"
              defaultValue={
                settings?.escalationRules ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Escalate complaints, payment disputes, unusual visa cases, legal matters, and requests requiring human judgment."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Handoff rules
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Define when and where this employee should hand a
              conversation to another employee.
            </p>

            <textarea
              name="handoffRules"
              defaultValue={
                settings?.handoffRules ?? ""
              }
              disabled={!canEdit}
              rows={5}
              placeholder="Example: Transfer qualified sales opportunities to Kuba Sales. Transfer complex support cases to a human."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-xl font-black">
              Working hours
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Define when this employee should normally operate.
            </p>

            <textarea
              name="workingHours"
              defaultValue={
                settings?.workingHours ?? ""
              }
              disabled={!canEdit}
              rows={4}
              placeholder="Example: Monday-Friday, 8:00 AM-5:00 PM Ghana time."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </section>

        {canEdit && (
  <div className="flex justify-end border-t border-white/[0.08] pt-6">
    <button
      type="submit"
      className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
    >
      Save Employee Settings
    </button>
  </div>
)}

{!canEdit && (
  <div className="border-t border-white/[0.08] pt-6 text-sm text-white/40">
    Only business owners and administrators can edit
    employee settings.
  </div>
)}
</form>
      </div>
    </main>
  );
}