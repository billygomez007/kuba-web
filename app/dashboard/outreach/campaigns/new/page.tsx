"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "../../../../components/ui/Button";
import FormField from "../../../../components/ui/FormField";
import LoadingState from "../../../../components/ui/LoadingState";

type Employee = { id: string; name: string; type: string; status: string };

export default function NewCampaignPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/ai-employees", { cache: "no-store" });
          const data = await response.json();
          const outreachEmployees: Employee[] = (data.employees ?? []).filter(
            (employee: Employee) => employee.type === "outreach" && employee.status === "active",
          );
          setEmployees(outreachEmployees);
          if (outreachEmployees[0]) setEmployeeId(outreachEmployees[0].id);
        } catch {
          setError("Unable to load your Outreach AI employees.");
        } finally {
          setLoadingEmployees(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!employeeId) {
      setError("Activate a Kuba Outreach employee before creating a campaign.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, employeeId, channel: "email" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create campaign.");
      router.push(`/dashboard/outreach/campaigns/${data.campaign.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create campaign.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard/outreach/campaigns" className="text-xs font-semibold text-text-tertiary hover:text-accent">
          ← Campaigns
        </Link>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.03em]">New campaign</h1>
        <p className="mt-2 text-sm text-text-tertiary">
          Start with the basics. You&apos;ll add recipients, sequence steps, and review everything before launch.
        </p>

        {loadingEmployees ? (
          <div className="mt-8 rounded-card border border-border-default bg-surface-card">
            <LoadingState message="Loading Kuba Outreach employees..." />
          </div>
        ) : employees.length === 0 ? (
          <div className="mt-8 rounded-card border border-border-default bg-surface-card p-6 text-sm text-text-tertiary">
            You don&apos;t have an active Kuba Outreach employee yet.{" "}
            <Link href="/dashboard/ai-employees" className="text-accent hover:underline">
              Activate one
            </Link>{" "}
            before creating a campaign.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-card border border-border-default bg-surface-card p-6">
            <FormField label="Campaign name" required>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={200}
                placeholder="Q1 expansion outreach"
                className="w-full rounded-control border border-border-default bg-surface-page px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
              />
            </FormField>

            <FormField label="Objective / description" description="What is this campaign for and who does it target?">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Reach recently expanded logistics companies about warehouse automation."
                className="w-full rounded-control border border-border-default bg-surface-page px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
              />
            </FormField>

            <FormField label="Outreach AI employee">
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-control border border-border-default bg-surface-page px-4 py-3 text-sm text-white outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Delivery channel" description="WhatsApp campaign automation is not available yet.">
              <div className="flex gap-3">
                <span className="inline-flex items-center gap-2 rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                  Email
                </span>
                <span
                  title="WhatsApp campaign automation isn't implemented yet"
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-control border border-border-muted bg-surface-page px-4 py-3 text-sm font-semibold text-text-muted"
                >
                  WhatsApp <span className="text-[10px] uppercase tracking-wide">Coming later</span>
                </span>
              </div>
            </FormField>

            {error && <div className="rounded-control border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

            <div className="mt-2 flex justify-end gap-3">
              <Button href="/dashboard/outreach/campaigns" variant="secondary">
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !name.trim()}>
                {submitting ? "Creating..." : "Create draft"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
