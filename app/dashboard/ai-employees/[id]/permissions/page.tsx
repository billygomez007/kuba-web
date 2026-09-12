"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import StatusBadge from "../../../../components/ui/StatusBadge";
import LoadingState from "../../../../components/ui/LoadingState";
import ErrorState from "../../../../components/ui/ErrorState";

type Decision = "denied" | "allowed" | "requires_approval";
type AutonomyLevel = "assistant" | "operator" | "autonomous";
type ActionRow = { action: string; kind: "read" | "write" | "communication"; label: string; description: string; decision: Decision };

const levels: { id: AutonomyLevel; name: string; description: string }[] = [
  { id: "assistant", name: "Assistant Mode", description: "Every action — even routine ones — is queued for human approval before it happens." },
  { id: "operator", name: "Operator Mode", description: "Routine CRM actions (leads, follow-ups, appointments, tickets) happen directly. Customer messages always need approval." },
  { id: "autonomous", name: "Autonomous Mode", description: "The widest allowed range of routine actions happen directly. Customer messages still always need approval." },
];

const DECISION_LABEL: Record<Decision, string> = { denied: "Off", allowed: "Allowed", requires_approval: "Needs approval" };

export default function EmployeePermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<{ name: string; type: string; status: string } | null>(null);
  const [level, setLevel] = useState<AutonomyLevel>("operator");
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/ai-employees/${id}/permissions`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) { if (!cancelled) setError(data.error || "Unable to load permissions."); return; }
        if (!cancelled) {
          setEmployee(data.employee);
          setLevel(data.autonomyLevel);
          setActions(data.actions);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  function applyLevelDefaults(newLevel: AutonomyLevel) {
    setLevel(newLevel);
    setActions((current) => current.map((row) => {
      if (row.kind === "communication") return row;
      if (row.kind === "read") return { ...row, decision: "allowed" };
      return { ...row, decision: newLevel === "assistant" ? "requires_approval" : "allowed" };
    }));
  }

  function setActionDecision(action: string, decision: Decision) {
    setActions((current) => current.map((row) => (row.action === action ? { ...row, decision } : row)));
  }

  async function save() {
    setSaving(true); setMessage(""); setError("");
    const policy = Object.fromEntries(actions.map((row) => [row.action, row.decision]));
    const response = await fetch(`/api/ai-employees/${id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autonomyLevel: level, policy }) });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to save autonomy settings.");
    } else {
      setMessage("Autonomy settings saved.");
      setLevel(data.autonomyLevel);
      setActions(data.actions);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState variant="page" message="Loading autonomy controls..." />;
  if (error && !employee) return <ErrorState variant="page" message={error} />;
  if (!employee) return null;

  const readActions = actions.filter((row) => row.kind === "read");
  const writeActions = actions.filter((row) => row.kind === "write");
  const communicationActions = actions.filter((row) => row.kind === "communication");

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-text-primary sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href={`/dashboard/ai-employees/${id}`} className="text-xs font-semibold text-text-tertiary hover:text-accent">
          ← {employee.name}
        </Link>

        <header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent/70">Autonomy and approval controls</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">What can {employee.name} do?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-tertiary">
              This sets the real, server-enforced boundary for this employee — every action listed below is backed by an actual capability, and every save takes effect immediately.
            </p>
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-black disabled:opacity-50">
            {saving ? "Saving..." : "Save controls"}
          </button>
        </header>

        {message && <p className="mt-5 rounded-xl border border-success/25 bg-success/10 p-3 text-sm text-success">{message}</p>}
        {error && <p className="mt-5 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {levels.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyLevelDefaults(item.id)}
              className={`rounded-panel border p-6 text-left transition ${level === item.id ? "border-accent/35 bg-accent/[0.08]" : "border-border-default bg-surface-card hover:border-border-default"}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">{item.name}</h2>
                <span className="text-accent">{level === item.id ? "✓" : ""}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
            </button>
          ))}
        </section>

        <p className="mt-4 text-xs text-text-muted">
          Selecting a mode sets sensible defaults below — you can still fine-tune any individual action afterward.
        </p>

        <section className="mt-6 rounded-panel border border-border-default bg-surface-card p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">Information access</p>
          <h2 className="mt-2 text-2xl font-black">What {employee.name} can look up</h2>
          <div className="mt-6 space-y-3">
            {readActions.map((row) => (
              <div key={row.action} className="flex items-center justify-between gap-4 rounded-control border border-border-muted bg-surface-subtle p-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                  <p className="text-xs text-text-tertiary">{row.description}</p>
                </div>
                <StatusBadge status={row.decision === "allowed" ? "success" : "neutral"} label={DECISION_LABEL[row.decision]} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-panel border border-border-default bg-surface-card p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">Business actions</p>
          <h2 className="mt-2 text-2xl font-black">What {employee.name} can do</h2>
          <p className="mt-2 text-sm text-text-tertiary">Each action can run directly, always wait for a human decision, or be switched off entirely.</p>
          <div className="mt-6 space-y-2">
            {writeActions.map((row) => (
              <div key={row.action} className="flex flex-col gap-3 rounded-control border border-border-muted bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                  <p className="text-xs text-text-tertiary">{row.description}</p>
                </div>
                <div className="flex gap-2">
                  {(["denied", "requires_approval", "allowed"] as Decision[]).map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      onClick={() => setActionDecision(row.action, decision)}
                      className={`rounded-pill border px-3 py-1.5 text-xs font-bold ${row.decision === decision ? "border-accent/35 bg-accent/10 text-accent" : "border-border-default text-text-tertiary hover:border-border-default"}`}
                    >
                      {DECISION_LABEL[decision]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-panel border border-warning/25 bg-warning/[0.04] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-warning">Customer communication</p>
          <h2 className="mt-2 text-2xl font-black">Sending a message to a customer</h2>
          <p className="mt-2 text-sm leading-6 text-text-tertiary">
            {employee.name} can never send a WhatsApp, SMS, or email message on its own — this always creates a pending approval request that a human must review first, at every autonomy level.
          </p>
          <div className="mt-5 space-y-3">
            {communicationActions.map((row) => (
              <div key={row.action} className="flex items-center justify-between gap-4 rounded-control border border-warning/20 bg-black/10 p-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                  <p className="text-xs text-text-tertiary">{row.description}</p>
                </div>
                <StatusBadge status="warning" label="Always requires approval" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
