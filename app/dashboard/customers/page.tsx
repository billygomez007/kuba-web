"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Dialog from "../../components/ui/Dialog";
import FormField from "../../components/ui/FormField";
import Button from "../../components/ui/Button";
import MetricCard from "../../components/ui/MetricCard";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/EmptyState";

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  async function loadCustomers() {
    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load customers.");
      }

      const data = await response.json();
      setCustomers(data.customers ?? []);
    } catch (error) {
      console.error("Customer loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.source,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [customers, search]);

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.05] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-6 py-10 lg:px-10 lg:py-14">

        {/* Header */}
        <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              Customer relationship management
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Customers
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/40">
              One place for the people and businesses your AI workforce
              serves.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
          >
            + Add customer
          </button>
        </section>

        {/* Stats */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Total customers"
            value={customers.length}
            description="People and businesses in your CRM"
          />

          <MetricCard
            label="With email"
            value={customers.filter((customer) => customer.email).length}
            description="Customers with an email address"
          />

          <MetricCard
            label="With phone"
            value={customers.filter((customer) => customer.phone).length}
            description="Customers with a phone number"
          />
        </section>

        {/* Customer database */}
        <section className="mt-14">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                Customer database
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Your customers
              </h2>
            </div>

            <div className="w-full lg:w-96">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            {loading ? (
              <LoadingState message="Loading customers..." />
            ) : filteredCustomers.length === 0 ? (
              <EmptyState
                icon="◎"
                title={search.trim() ? "No customers found." : "Your customer database is empty."}
                description={
                  search.trim()
                    ? "Try a different name, email address, or phone number."
                    : "Add your first customer and start building SuperKuba's shared customer intelligence."
                }
                actionLabel={search.trim() ? undefined : "+ Add first customer"}
                onAction={search.trim() ? undefined : () => setShowForm(true)}
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-left">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                        Customer
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                        Contact
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                        Source
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                        Added
                      </th>

                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <CustomerRow
                        key={customer.id}
                        customer={customer}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* AI CRM */}
        <section className="relative mt-14 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.025] p-8 sm:p-10">
          <div className="pointer-events-none absolute right-[-120px] top-[-150px] h-[450px] w-[450px] rounded-full bg-violet-600/10 blur-[120px]" />

          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              AI-powered customer intelligence
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Every customer becomes part of the Kuba workforce.
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/40">
              Customer information can become shared context across Sales,
              Receptionist, Marketing, Appointment, Support, and other Kuba
              AI employees.
            </p>
          </div>
        </section>
      </div>

      {showForm && (
        <AddCustomerModal
          onClose={() => setShowForm(false)}
          onCreated={(customer) => {
            setCustomers((current) => [customer, ...current]);
            setShowForm(false);
          }}
        />
      )}
    </main>
  );
}

function CustomerRow({
  customer,
}: {
  customer: Customer;
}) {
  const initials = (customer.name || "Customer")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const date = new Date(customer.createdAt);

  return (
    <tr
      className="group border-b border-white/[0.05] transition hover:bg-white/[0.025]"
      onClick={() => {
        window.location.href = `/dashboard/customers/${customer.id}`;
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          window.location.href = `/dashboard/customers/${customer.id}`;
        }
      }}
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xs font-bold text-white/60">
            {initials}
          </div>

          <div>
            <p className="text-sm font-semibold text-white/85 group-hover:text-white">
              {customer.name || "Unnamed customer"}
            </p>

            <p className="mt-1 text-xs text-white/25">
              Customer ID · {customer.id.slice(0, 8)}
            </p>
          </div>
        </div>
      </td>

      <td className="px-6 py-5">
        <div className="space-y-1 text-xs">
          {customer.email && (
            <p className="text-white/50">{customer.email}</p>
          )}

          {customer.phone && (
            <p className="text-white/30">{customer.phone}</p>
          )}

          {!customer.email && !customer.phone && (
            <p className="text-white/20">No contact details</p>
          )}
        </div>
      </td>

      <td className="px-6 py-5">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {customer.source || "Unknown"}
        </span>
      </td>

      <td className="px-6 py-5 text-xs text-white/30">
        {Number.isNaN(date.getTime())
          ? "Unknown"
          : date.toLocaleDateString()}
      </td>

      <td className="px-6 py-5 text-right">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active
        </span>
      </td>
    </tr>
  );
}


function AddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create customer.");
      }

      onCreated(data.customer);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create customer.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog title="Add customer" description="Add a customer to your SuperKuba business database." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Customer name"
            autoFocus
            className={INPUT_CLASSES}
          />
        </FormField>

        <FormField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            className={INPUT_CLASSES}
          />
        </FormField>

        <FormField label="Phone">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+233..."
            className={INPUT_CLASSES}
          />
        </FormField>

        <FormField label="Source">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className={INPUT_CLASSES}
          >
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="sales">Sales</option>
            <option value="other">Other</option>
          </select>
        </FormField>

        {error && (
          <div role="alert" className="rounded-control border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-3 border-t border-border-muted pt-5">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>

          <Button type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? "Adding..." : "Add customer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const INPUT_CLASSES =
  "w-full rounded-control border border-border-default bg-surface-subtle px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40 focus:ring-2 focus:ring-accent/10";
