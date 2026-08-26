"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Customer = {
  id: string;
  businessId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string | number | Date;
  updatedAt: string | number | Date;
};
type Relationship = { conversations: Array<{ id: string; status: string }>; leads: Array<{ id: string; stage: string }>; followUps: Array<{ id: string; status: string }>; tags: Array<{ id: string; tag: string }>; appointments: Array<{ id: string; title: string; startAt: string; status: string }>; tickets: Array<{ id: string; ticketReference: string; subject: string; status: string; priority: string }> };

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relationship, setRelationship] = useState<Relationship>({ conversations: [], leads: [], followUps: [], tags: [], appointments: [], tickets: [] });

  useEffect(() => {
    async function loadCustomer() {
      try {
        const { id } = await params;

        const response = await fetch(`/api/customers/profile?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load customer.");
        }

        setCustomer(data.customer);
        setRelationship({ conversations: data.conversations || [], leads: data.leads || [], followUps: data.followUps || [], tags: data.tags || [], appointments: data.appointments || [], tickets: data.tickets || [] });
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load customer.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCustomer();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
          <p className="text-sm text-white/30">
            Loading customer...
          </p>
        </div>
      </main>
    );
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen bg-[#050507] text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
          <Link
            href="/dashboard/customers"
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            ← Back to customers
          </Link>

          <div className="mt-8 rounded-3xl border border-red-400/10 bg-red-400/[0.04] p-8">
            <h1 className="text-xl font-bold">
              Customer unavailable
            </h1>

            <p className="mt-2 text-sm text-white/40">
              {error || "This customer could not be found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const initials = (customer.name || "Customer")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const createdDate = new Date(customer.createdAt);

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.05] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-6 py-10 lg:px-10 lg:py-14">

        <Link
          href="/dashboard/customers"
          className="inline-flex items-center text-sm font-medium text-white/35 transition hover:text-white"
        >
          ← Customers
        </Link>

        {/* Customer header */}
        <section className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.025] p-7 sm:p-9">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.05] text-xl font-black text-cyan-200">
                {initials}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
                  Customer profile
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-[-0.03em]">
                  {customer.name || "Unnamed customer"}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Active
                  </span>

                  {customer.source && (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">
                      {customer.source}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link href="/dashboard/inbox" className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white">Open inbox</Link>
          </div>
        </section>

        {/* Overview */}
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.025] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              Contact information
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <InfoItem
                label="Email"
                value={customer.email || "Not provided"}
              />

              <InfoItem
                label="Phone"
                value={customer.phone || "Not provided"}
              />

              <InfoItem
                label="Source"
                value={customer.source || "Unknown"}
              />

              <InfoItem
                label="Customer ID"
                value={customer.id}
              />
              <InfoItem label="Tags" value={relationship.tags.length ? relationship.tags.map((item) => item.tag).join(", ") : "No tags"} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              Customer since
            </p>

            <p className="mt-5 text-2xl font-black">
              {Number.isNaN(createdDate.getTime())
                ? "Unknown"
                : createdDate.toLocaleDateString()}
            </p>

            <p className="mt-2 text-sm leading-6 text-white/30">
              This customer is part of your business&apos;s shared Kuba
              customer intelligence.
            </p>
          </div>
        </section>

        {/* Activity */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <SalesActivityPanel customerId={customer.id} />

          <RelationshipPanel icon="◌" title="Conversations" count={relationship.conversations.length} description={`${relationship.conversations.filter((item) => item.status !== "resolved").length} currently open`} href="/dashboard/conversations" />

          <RelationshipPanel icon="✓" title="Leads & follow-ups" count={relationship.leads.length + relationship.followUps.length} description={`${relationship.leads.length} leads · ${relationship.followUps.filter((item) => item.status !== "completed").length} open follow-ups`} href="/dashboard/follow-ups" />

          <PlaceholderPanel
            icon="✦"
            title="AI employee activity"
            description="See how Kuba Sales, Receptionist, Support, Marketing, and other AI employees interact with this customer."
          />

          <RelationshipPanel icon="◉" title="Business Brain memory" count={relationship.leads.length + relationship.conversations.length} description="Customer context is derived from scoped lead and conversation history." href="/dashboard/business-brain/memory" />

          <RelationshipPanel icon="□" title="Appointments" count={relationship.appointments.length} description={`${relationship.appointments.filter((item) => item.status !== "cancelled").length} active appointment(s)`} href="/dashboard/appointments" />

          <RelationshipPanel icon="◇" title="Support tickets" count={relationship.tickets.length} description={`${relationship.tickets.filter((item) => !["resolved", "closed"].includes(item.status)).length} unresolved ticket(s)`} href="/dashboard/tickets" />
        </section>

        {/* Future intelligence */}
        <section className="relative mt-6 overflow-hidden rounded-[32px] border border-violet-400/10 bg-violet-400/[0.025] p-8">
          <div className="pointer-events-none absolute right-[-100px] top-[-150px] h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              Kuba intelligence
            </p>

            <h2 className="mt-3 text-2xl font-black">
              One customer. One shared context.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/35">
              The goal is simple: Kuba&apos;s AI employees should understand the
              same customer context instead of operating as isolated tools.
              That means less repetition for your team and a much more
              intelligent customer experience.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
        {label}
      </p>

      <p className="mt-2 break-all text-sm font-medium text-white/70">
        {value}
      </p>
    </div>
  );
}

function SalesActivityPanel({
  customerId,
}: {
  customerId: string;
}) {
  const [activities, setActivities] = useState<
    {
      id: string;
      type: string;
      title: string;
      description: string | null;
      createdAt: string | number | Date;
    }[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await fetch(
          `/api/ai/sales/activities?customerId=${encodeURIComponent(customerId)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setActivities(data.activities || []);
      } catch (error) {
        console.error(
          "Customer sales activity error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [customerId]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7">

      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] text-lg text-cyan-300">
        ↗
      </div>

      <h2 className="mt-5 text-lg font-bold">
        Sales activity
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/30">
        Leads, opportunities, follow-ups, and sales activities connected to this customer.
      </p>

      {loading ? (

        <div className="mt-6 rounded-xl border border-white/[0.07] px-4 py-5 text-center">
          <p className="text-xs text-white/25">
            Loading sales activity...
          </p>
        </div>

      ) : activities.length === 0 ? (

        <div className="mt-6 rounded-xl border border-dashed border-white/[0.07] px-4 py-5 text-center">
          <p className="text-xs text-white/20">
            No sales activity yet
          </p>
        </div>

      ) : (

        <div className="mt-6 space-y-3">

          {activities.map((activity) => (

            <div
              key={activity.id}
              className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
            >

              <div className="flex items-start justify-between gap-4">

                <div className="min-w-0">

                  <p className="text-sm font-semibold">
                    {activity.title}
                  </p>

                  {activity.description && (
                    <p className="mt-1 text-xs leading-5 text-white/30">
                      {activity.description}
                    </p>
                  )}

                </div>

                <span className="shrink-0 rounded-full bg-cyan-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                  {activity.type}
                </span>

              </div>

              <p className="mt-3 text-[10px] text-white/20">
                {new Date(
                  activity.createdAt,
                ).toLocaleString()}
              </p>

            </div>

          ))}

        </div>

      )}

    </div>
  );
}


function RelationshipPanel({ icon, title, count, description, href }: { icon: string; title: string; count: number; description: string; href: string }) {
  return <Link href={href} className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 transition hover:border-cyan-300/20"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] text-lg text-cyan-200">{icon}</div><h2 className="mt-5 text-lg font-bold">{title}</h2><p className="mt-3 text-3xl font-black">{count}</p><p className="mt-2 text-sm text-white/30">{description}</p></Link>;
}

function PlaceholderPanel({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-white/50">
        {icon}
      </div>

      <h2 className="mt-5 text-lg font-bold">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/30">
        {description}
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-white/[0.07] px-4 py-5 text-center">
        <p className="text-xs text-white/20">
          No activity yet
        </p>
      </div>
    </div>
  );
}
