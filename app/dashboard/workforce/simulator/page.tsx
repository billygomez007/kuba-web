"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Employee = { id: string; name: string; type: string; status: string };
type Transcript = { employeeId: string; employeeName: string; response: string };
type Evaluation = { responseQuality: number; routingAccuracy: number; policyCompliance: number; escalationDecision: string; resolutionLikelihood: number; approvalRequired: boolean; recommendations: string[] };
type History = { id: string; title: string; description: string | null; createdAt: string };

const scenarios = [
  ["Dental clinic", "Patient complains about appointment delay", "Resolve the complaint or escalate appropriately."],
  ["Travel agency", "Customer wants urgent visa assistance", "Provide accurate guidance and route specialist help."],
  ["Law firm", "Client requests legal consultation", "Capture the enquiry and arrange safe follow-up."],
];

export default function WorkforceSimulatorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [customerType, setCustomerType] = useState("Prospective customer");
  const [industry, setIndustry] = useState("");
  const [scenario, setScenario] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/ai-employees", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setEmployees(data.employees || []);
      const historyResponse = await fetch("/api/workforce/simulator", { cache: "no-store" });
      const historyData = await historyResponse.json();
      if (historyResponse.ok) setHistory(historyData.history || []);
    } catch {
      setError("Unable to load simulator data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  function toggleEmployee(id: string) { setSelectedEmployees((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
    function chooseScenario(item: string[]) { setIndustry(item[0]); setScenario(item[1]); setExpectedOutcome(item[2]); }

  async function runSimulation() {
    setRunning(true); setError(""); setTranscript([]); setEvaluation(null);
    const response = await fetch("/api/workforce/simulator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerType, industry, scenario, expectedOutcome, employeeIds: selectedEmployees }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to run simulation."); else { setTranscript(data.transcript || []); setEvaluation(data.evaluation || null); void load(); }
    setRunning(false);
  }

  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-7xl"><header><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">AI Workforce Training</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Workforce Simulator</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Test customer situations, observe coordinated responses, and improve your AI workforce before live deployment.</p></header>{error && <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-200">{error}</p>}<div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.1fr]"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Scenario builder</p><h2 className="mt-2 text-2xl font-black">Design a test</h2></div><span className="text-xs text-white/30">{selectedEmployees.length} employees</span></div><div className="mt-6 space-y-5"><Field label="Customer type" value={customerType} onChange={setCustomerType} /><Field label="Industry" value={industry} onChange={setIndustry} placeholder="Example: Dental clinic" /><label><span className="text-sm font-semibold text-white/70">Situation</span><textarea value={scenario} onChange={(event) => setScenario(event.target.value)} rows={4} placeholder="Describe what the simulated customer needs..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label><label><span className="text-sm font-semibold text-white/70">Expected outcome</span><textarea value={expectedOutcome} onChange={(event) => setExpectedOutcome(event.target.value)} rows={3} placeholder="What should a good outcome look like?" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label></div><div className="mt-7"><p className="text-xs font-bold uppercase tracking-wider text-white/30">Quick scenarios</p><div className="mt-3 space-y-2">{scenarios.map((item) => <button key={item[1]} type="button" onClick={() => chooseScenario(item)} className="w-full rounded-xl border border-white/[0.08] bg-black/20 p-3 text-left text-xs text-white/55 hover:border-cyan-300/25 hover:text-white">{item[1]}</button>)}</div></div></section><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">AI workforce simulation</p><h2 className="mt-2 text-2xl font-black">Employees involved</h2><p className="mt-2 text-sm leading-6 text-white/40">Select one employee for focused testing or several for a handoff simulation.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{loading ? <p className="text-sm text-white/35">Loading employees...</p> : employees.filter((employee) => employee.status === "active").map((employee) => <button key={employee.id} type="button" onClick={() => toggleEmployee(employee.id)} className={`rounded-2xl border p-4 text-left ${selectedEmployees.includes(employee.id) ? "border-cyan-300/35 bg-cyan-300/[0.08]" : "border-white/[0.08] bg-black/20"}`}><div className="flex items-center justify-between"><span className="font-bold text-white/80">{employee.name}</span><span className="text-cyan-300">{selectedEmployees.includes(employee.id) ? "✓" : "○"}</span></div><p className="mt-1 text-xs capitalize text-white/35">{employee.type.replaceAll("-", " ")}</p></button>)}</div><button type="button" onClick={() => void runSimulation()} disabled={running || !scenario.trim() || selectedEmployees.length === 0} className="mt-7 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-40">{running ? "Running simulation..." : "Run workforce simulation"}</button>{transcript.length > 0 && <div className="mt-7 space-y-3"><p className="text-xs font-bold uppercase tracking-wider text-white/30">Safe operational transcript</p>{transcript.map((item) => <div key={item.employeeId} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs font-bold text-cyan-200">{item.employeeName}</p><p className="mt-2 text-sm leading-6 text-white/65">{item.response}</p></div>)}</div>}</section></div>{evaluation && <section className="mt-6 rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300/70">Performance evaluation</p><h2 className="mt-2 text-2xl font-black">Simulation result</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Response quality", evaluation.responseQuality], ["Routing accuracy", evaluation.routingAccuracy], ["Policy compliance", evaluation.policyCompliance], ["Resolution likelihood", evaluation.resolutionLikelihood], ["Approval", evaluation.approvalRequired ? "Required" : "Not required"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-xl font-black text-white/80">{value}{typeof value === "number" ? "%" : ""}</p></div>)}</div><p className="mt-5 text-sm text-white/55">Escalation decision: {evaluation.escalationDecision}</p>{evaluation.recommendations.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold text-white/80">Training recommendations</h3><div className="mt-3 space-y-2">{evaluation.recommendations.map((item) => <p key={item} className="rounded-xl bg-black/20 px-4 py-3 text-sm text-white/60">✓ {item}</p>)}</div></div>}</section>}<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Simulation history</p><h2 className="mt-2 text-2xl font-black">Previous evaluations</h2><div className="mt-5 space-y-3">{history.length ? history.map((item) => <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-sm font-bold text-white/75">{item.title}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">{item.description}</p><p className="mt-2 text-[10px] text-white/20">{new Date(item.createdAt).toLocaleString()}</p></div>) : <p className="text-sm text-white/35">Simulation results will appear here after the first run.</p>}</div></section></div></main>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
