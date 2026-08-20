import { and, eq, count } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiEmployees,
  businessUsers,
  users,
  conversations,
  handoffs,
  aiEmployeeActivities,
} from "@/db/schema";
import SalesWorkspace from "../../../components/employees/SalesWorkspace";
import ReceptionistWorkspace from "../../../components/employees/ReceptionistWorkspace";
import CustomerSupportWorkspace from "../../../components/employees/CustomerSupportWorkspace";
import GeneralManagerWorkspace from "../../../components/employees/GeneralManagerWorkspace";
import AIEmployeeHeader from "../../../components/employees/AIEmployeeHeader";

type Props = {
  params: Promise<{
    id: string;
  }>;
};


function getEmployeeAvatar(type: string) {
  const avatars: Record<string, string> = {
    receptionist: "/avatars/receptionist.png",
    sales: "/avatars/sales.png",
    "customer-support": "/avatars/customer-support.png",
    accountant: "/avatars/accountant.png",
    finance: "/avatars/finance.png",
    marketing: "/avatars/marketing.png",
    hr: "/avatars/hr.png",
    operations: "/avatars/operations.png",
    appointment: "/avatars/appointment.png",
  };

  return avatars[type] || "/avatars/receptionist.png";
}


function getEmployeeCategory(type: string) {
  const categories: Record<string, string> = {
    receptionist: "Customer Experience",
    sales: "Revenue",
    "customer-support": "Customer Experience",
    accountant: "Finance",
    finance: "Finance",
    marketing: "Growth",
    hr: "People",
    operations: "Operations",
    appointment: "Operations",
  };

  return categories[type] || "AI Workforce";
}


function getEmployeeSpecialization(type: string) {
  const specializations: Record<string, string> = {
    receptionist:
      "Handles customers, inquiries, bookings, and lead capture.",
    sales:
      "Manages leads, follow-ups, and sales intelligence.",
    "customer-support":
      "Answers customer questions and resolves support requests.",
    accountant:
      "Handles finance workflows and reports.",
    finance:
      "Supports financial planning and business analysis.",
    marketing:
      "Creates campaigns, content, and customer engagement strategies.",
    hr:
      "Supports recruitment and people operations.",
    operations:
      "Manages business processes and workflows.",
    appointment:
      "Schedules appointments and manages bookings.",
  };

  return (
    specializations[type] ||
    "Helping your business get work done."
  );
}

export default async function EmployeeWorkspace({
  params,
}: Props) {
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
    })
    .from(businessUsers)
    .where(
      eq(
        businessUsers.userId,
        session.user.id,
      ),
    )
    .limit(1);

  const business = membership[0];

  if (!business) {
    redirect("/onboarding");
  }

  const employeeResult = await db
    .select({
      employee: aiEmployees,
      supervisor: users.name,
    })
    .from(aiEmployees)
    .leftJoin(
      users,
      eq(
        users.id,
        aiEmployees.supervisorUserId,
      ),
    )
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

  const employeeData = employeeResult[0];

  if (!employeeData) {
    notFound();
  }

  const employee = {
    ...employeeData.employee,
    supervisor: employeeData.supervisor,
  };

  const conversationResult = await db
    .select({
      total: count(),
    })
    .from(conversations)
    .where(
      eq(
        conversations.assignedEmployeeId,
        id,
      ),
    );

  const handoffResult = await db
    .select({
      total: count(),
    })
    .from(handoffs)
    .where(
      eq(
        handoffs.fromEmployeeId,
        id,
      ),
    );

  const activities = await db
    .select()
    .from(aiEmployeeActivities)
    .where(
      eq(
        aiEmployeeActivities.employeeId,
        id,
      ),
    )
    .limit(10);

  const data = {
    metrics: {
      conversations: conversationResult[0]?.total || 0,
      handoffs: handoffResult[0]?.total || 0,
    },
    activities,
  };

  return (
    <main className="min-h-screen bg-[#07070A] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        <AIEmployeeHeader
          name={employee.name}
          type={employee.type}
          status={employee.status}
          description={employee.description}
        />


        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="grid gap-4 md:grid-cols-3">

            <div>
              <p className="text-xs uppercase text-white/35">
                Status
              </p>
              <p className="mt-2 font-bold">
                {employee.status}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-white/35">
                Supervision
              </p>
              <p className="mt-2 font-bold">
                {employee.supervisionMode}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-white/35">
                Supervisor
              </p>
              <p className="mt-2 font-bold">
                {employee.supervisor || "Owner"}
              </p>
            </div>

          </div>
        </section>


        <div className="mt-8">
          {employee.type === "sales" ? (
            <SalesWorkspace employeeId={employee.id} />
          ) : employee.type === "receptionist" ? (
            <ReceptionistWorkspace />
          ) : employee.type === "customer-support" ? (
            <CustomerSupportWorkspace
              employeeId={employee.id}
              employeeName={employee.name}
            />
          ) : employee.type === "general-manager" ? (
            <GeneralManagerWorkspace
              employeeId={employee.id}
              employeeName={employee.name}
            />
          ) : (
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-8">
              <h2 className="text-2xl font-bold">
                {employee.name}
              </h2>

              <p className="mt-2 text-white/40">
                This AI employee workspace is being prepared.
              </p>
            </section>
          )}
        </div>

      </div>
    </main>
  );
}
