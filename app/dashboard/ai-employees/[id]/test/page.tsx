"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; type: string; status: string };
type Workspace = { employee: Employee; knowledge?: { sources: Array<{ name: string }>; sourceCount: number; faqsAvailable: boolean; businessInformationAvailable: boolean } };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const scenarios: Record<string, string[]> = {
  receptionist: ["Customer asking for information", "Customer needs human help"],
  sales: ["Customer interested in buying", "Customer needs human help"],
  "customer-support": ["Customer has a problem", "Customer needs human help"],
  "general-manager": ["Review today's business priorities", "Customer needs human help"],
};

const capabilities: Record<string, string[]> = {
  receptionist: ["Lead capture", "Customer information", "Appointment support", "Conversation escalation"],
  sales: ["Lead qualification", "Customer follow-up", "Pipeline updates", "Opportunity discovery"],
  "customer-support": ["Issue resolution", "Customer context", "Support responses", "Escalation"],
  "general-manager": ["Business analysis", "Priority planning", "Team coordination", "Escalation"],
};

export default function EmployeeTestPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversationId] = useState(() => `test-${id}-${crypto.randomUUID()}`);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployee() {
      try {
        const response = await fetch(`/api/ai-employees/${id}/dashboard`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load employee.");
        if (!cancelled) setWorkspace(data);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load employee.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEmployee();
    return () => { cancelled = true; };
  }, [id]);

  const employee = workspace?.employee;
  const quickTests = useMemo(() => scenarios[employee?.type || ""] || ["Ask this employee what it can help with"], [employee?.type]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || !employee || sending) return;

    setInput("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }]);
    setEvents(["Preparing response"]);
    setSending(true);
    setError("");

    try {
      const endpoint = employee.type === "sales"
        ? "/api/ai/sales"
        : employee.type === "customer-support"
          ? "/api/ai/customer-support"
          : employee.type === "general-manager"
            ? "/api/ai/general-manager"
            : employee.type === "receptionist"
              ? "/api/ai/receptionist"
              : "";

      if (!endpoint) throw new Error("This employee does not have a connected test runtime yet.");
      const body = employee.type === "receptionist"
        ? { message, conversationId, employeeId: employee.id }
        : { message, employeeId: employee.id };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The AI employee could not respond.");
      setEvents(["Response prepared"]);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: data.response || "No response was returned." }]);
    } catch (sendError) {
      setEvents([]);
      setError(sendError instanceof Error ? sendError.message : "The AI employee could not respond.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <State message="Loading test console..." />;
  if (error && !employee) return <State message={error} error />;
  if (!employee) return <State message="AI employee not found." error />;

  const employeeCapabilities = capabilities[employee.type] || ["Business assistance", "Connected context", "Task support", "Escalation"];
  const knowledge = workspace?.knowledge;

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-7 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1600px]">
        <Link href={`/dashboard/ai-employees/${employee.id}`} className="text-xs font-semibold text-white/40 hover:text-cyan-300">← {employee.name}</Link>
        <header className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">AI Employee Test Console</p><h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Test {employee.name}</h1><p className="mt-2 text-sm text-white/40">Run controlled conversations before putting this employee into production.</p></header>

        <section className="mt-7 grid min-h-[720px] overflow-hidden rounded-3xl border border-white/10 bg-black/20 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col border-b border-white/10 xl:border-b-0 xl:border-r">
            <div className="border-b border-white/10 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Simulation workspace</p><h2 className="mt-2 text-xl font-black">Private test conversation</h2></div><Status status={employee.status} /></div><div className="mt-5 flex flex-wrap gap-2">{quickTests.map((scenario) => <button key={scenario} type="button" onClick={() => setInput(scenario)} className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/[0.1]">{scenario}</button>)}</div></div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">{messages.length === 0 ? <div className="flex h-full min-h-[300px] items-center justify-center"><div className="max-w-md text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-xl text-cyan-300">✦</div><h3 className="mt-5 text-lg font-bold">Start a safe test</h3><p className="mt-2 text-sm leading-6 text-white/35">Choose a scenario above or ask {employee.name} a question to see how it responds with your business context.</p></div></div> : messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-cyan-400 text-black" : "border border-white/10 bg-white/[0.05] text-white/75"}`}><p className="text-[10px] font-bold uppercase tracking-wider opacity-50">{message.role === "user" ? "Test input" : employee.name}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p></div></div>)}{sending && <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/35">Preparing a response...</div>}</div>
            {events.length > 0 && <div className="border-t border-white/10 px-5 py-3 text-xs text-cyan-200/60">Operational event: {events[0]}</div>}
            <form onSubmit={sendMessage} className="flex gap-3 border-t border-white/10 p-5"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Message ${employee.name}...`} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><button type="submit" disabled={sending || !input.trim()} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">Send</button></form>
          </div>

          <aside className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/[0.08] text-violet-200">✦</div><div><h2 className="font-bold">{employee.name}</h2><p className="text-xs capitalize text-white/35">{employee.type.replaceAll("-", " ")}</p></div></div><div className="mt-6 space-y-4"><Info label="Department" value={departmentFor(employee.type)} /><Info label="Business" value="Your connected business" /><Info label="Status" value={employee.status} /></div><div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Knowledge access</p><div className="mt-3 space-y-2">{["Business information", "FAQs", "Products and services", "Documents"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs text-white/60"><span>{item}</span><span className={index < 2 && knowledge ? "text-emerald-300" : "text-white/25"}>{index < 2 && knowledge ? "Connected" : "Available"}</span></div>)}</div></div><div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Capabilities</p><div className="mt-3 space-y-2">{employeeCapabilities.map((capability) => <div key={capability} className="text-xs text-white/55"><span className="mr-2 text-emerald-300">✓</span>{capability}</div>)}</div></div>{error && <p className="mt-7 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-xs leading-5 text-red-200">{error}</p>}</aside>
        </section>
      </div>
    </main>
  );
}

function Status({ status }: { status: string }) { const active = status === "active"; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} />{status}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-xs text-white/30">{label}</p><p className="mt-1 text-sm font-semibold text-white/70">{value}</p></div>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
function departmentFor(type: string) { return type === "sales" ? "Revenue Operations" : type === "general-manager" ? "Executive Operations" : type === "customer-support" || type === "receptionist" ? "Customer Operations" : "AI Workforce"; }
