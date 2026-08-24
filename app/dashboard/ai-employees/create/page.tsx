"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = {
  type: string;
  name: string;
  description: string;
  capabilities: string[];
};

const roles: Role[] = [
  { type: "receptionist", name: "Receptionist", description: "Welcome customers, answer enquiries, and route requests.", capabilities: ["Answer enquiries", "Capture leads", "Schedule appointments", "Escalate conversations"] },
  { type: "sales", name: "Sales Representative", description: "Qualify opportunities and keep revenue moving.", capabilities: ["Qualify leads", "Follow up customers", "Update pipeline", "Surface opportunities"] },
  { type: "customer-support", name: "Customer Support", description: "Resolve customer questions and service issues.", capabilities: ["Answer support questions", "Resolve common issues", "Track customer context", "Escalate complex requests"] },
  { type: "marketing", name: "Marketing Assistant", description: "Support campaigns, content, and customer engagement.", capabilities: ["Plan campaigns", "Create content", "Engage customers", "Track opportunities"] },
  { type: "operations", name: "Executive Assistant", description: "Coordinate business operations and important next actions.", capabilities: ["Organize work", "Monitor operations", "Coordinate teams", "Surface priorities"] },
  { type: "accountant", name: "Accountant", description: "Support finance workflows, records, and reporting.", capabilities: ["Organize records", "Support reporting", "Track finance tasks", "Escalate exceptions"] },
  { type: "custom", name: "Custom Employee", description: "Design an AI employee around a specific business workflow.", capabilities: ["Define responsibilities", "Choose a communication style", "Connect business context", "Set approval expectations"] },
];

const knowledgeOptions = ["Business profile", "FAQs", "Products and services", "Pricing", "Documents", "Policies"];
const approvalOptions = ["Discounts", "Refunds", "External messages", "Customer data changes"];

export default function CreateAIEmployeePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>(roles[0]);
  const [name, setName] = useState("Kuba Receptionist");
  const [department, setDepartment] = useState("Customer Operations");
  const [personality, setPersonality] = useState("Professional and helpful");
  const [description, setDescription] = useState(roles[0].description);
  const [knowledge, setKnowledge] = useState<string[]>(["Business profile", "FAQs"]);
  const [capabilities, setCapabilities] = useState<string[]>(roles[0].capabilities);
  const [approvals, setApprovals] = useState<string[]>(approvalOptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseRole(selectedRole: Role) {
    setRole(selectedRole);
    setName(`Kuba ${selectedRole.name}`);
    setDescription(selectedRole.description);
    setCapabilities(selectedRole.capabilities);
    setDepartment(selectedRole.name === "Sales Representative" ? "Revenue Operations" : selectedRole.name === "Accountant" ? "Finance Operations" : "Customer Operations");
  }

  function toggleValue(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function activate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai-employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), type: role.type, description: description.trim(), templateId: role.type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create AI employee.");

      const settings = new FormData();
      settings.set("employeeId", data.employee.id);
      settings.set("personality", personality);
      settings.set("communicationStyle", personality);
      settings.set("responsibilities", `${department}\n${capabilities.join("\n")}`);
      settings.set("roleInstructions", `Knowledge access: ${knowledge.join(", ")}. Approval review: ${approvals.join(", ")}.`);
      settings.set("escalationRules", approvals.includes("External messages") ? "Request approval before external messages." : "Escalate complex requests to a human.");
      const settingsResponse = await fetch("/api/ai-employees/settings", { method: "POST", body: settings });
      if (!settingsResponse.ok) throw new Error("Employee created, but settings could not be saved.");
      router.push(`/dashboard/ai-employees/${data.employee.id}`);
      router.refresh();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Unable to activate AI employee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/ai-employees" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← AI Workforce</Link>
        <header className="mt-5 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">AI Workforce Builder</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Create an AI employee</h1><p className="mt-3 text-sm leading-6 text-white/40">Shape a specialist for your business, connect its context, and activate it when ready.</p></header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">{["Select role", "Identity", "Business Brain", "Capabilities", "Approval settings", "Activation"].map((label, index) => <button key={label} type="button" onClick={() => setStep(index + 1)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm lg:w-full ${step === index + 1 ? "bg-cyan-300/[0.1] text-cyan-200" : "text-white/35 hover:bg-white/[0.04]"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-current text-xs">{index + 1}</span>{label}</button>)}</nav>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-8">
            {step === 1 && <><StepHeading eyebrow="Step 1 of 6" title="Choose a role" description="Start with a proven role and its recommended capabilities." /><div className="grid gap-3 md:grid-cols-2">{roles.map((item) => <button key={item.type} type="button" onClick={() => chooseRole(item)} className={`rounded-2xl border p-5 text-left transition ${role.type === item.type ? "border-cyan-300/40 bg-cyan-300/[0.08]" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="flex items-start justify-between gap-3"><h2 className="font-bold">{item.name}</h2>{role.type === item.type && <span className="text-cyan-300">✓</span>}</div><p className="mt-2 text-sm leading-6 text-white/40">{item.description}</p><p className="mt-4 text-xs text-cyan-200/60">{item.capabilities.slice(0, 2).join(" · ")}</p></button>)}</div></>}
            {step === 2 && <><StepHeading eyebrow="Step 2 of 6" title="Define the identity" description="Give your employee a clear role inside the business." /><div className="grid gap-5 md:grid-cols-2"><Field label="Employee name" value={name} onChange={setName} /><Field label="Department" value={department} onChange={setDepartment} /><Field label="Personality and tone" value={personality} onChange={setPersonality} /><Field label="Role" value={role.name} onChange={() => undefined} disabled /><label className="md:col-span-2"><span className="text-sm font-semibold text-white/70">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-300/40" /></label></div></>}
            {step === 3 && <><StepHeading eyebrow="Step 3 of 6" title="Connect the Business Brain" description="Choose the knowledge areas this employee should use. Existing shared knowledge remains the source of truth." /><ChoiceList values={knowledgeOptions} selected={knowledge} onToggle={(value) => toggleValue(value, knowledge, setKnowledge)} /></>}
            {step === 4 && <><StepHeading eyebrow="Step 4 of 6" title="Select capabilities" description="Tune the work this employee is prepared to handle." /><ChoiceList values={role.capabilities} selected={capabilities} onToggle={(value) => toggleValue(value, capabilities, setCapabilities)} /></>}
            {step === 5 && <><StepHeading eyebrow="Step 5 of 6" title="Set approval expectations" description="These preferences prepare the future approval workflow without changing execution rules today." /><ChoiceList values={approvalOptions} selected={approvals} onToggle={(value) => toggleValue(value, approvals, setApprovals)} /></>}
            {step === 6 && <><StepHeading eyebrow="Step 6 of 6" title="Ready to activate" description="Review the employee identity and activate its workspace." /><div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5"><p className="text-xs uppercase tracking-wider text-cyan-200/60">Employee preview</p><h2 className="mt-2 text-2xl font-black">{name || "Unnamed employee"}</h2><p className="mt-1 text-sm text-white/45">{role.name} · {department}</p><p className="mt-4 text-sm leading-6 text-white/60">{description}</p></div>{error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{error}</p>}</>}
            <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row"><button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || loading} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/55 disabled:opacity-30">Back</button>{step < 6 ? <button type="button" onClick={() => setStep((current) => Math.min(6, current + 1))} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">Continue</button> : <button type="button" onClick={() => void activate()} disabled={loading || !name.trim()} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{loading ? "Activating..." : "Create and activate employee"}</button>}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">{description}</p></div>; }
function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) { return <label><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40 disabled:opacity-50" /></label>; }
function ChoiceList({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) { return <div className="grid gap-3 md:grid-cols-2">{values.map((value) => <button key={value} type="button" onClick={() => onToggle(value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm transition ${selected.includes(value) ? "border-cyan-300/35 bg-cyan-300/[0.08] text-cyan-100" : "border-white/10 bg-black/20 text-white/55 hover:border-white/20"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-lg border text-xs ${selected.includes(value) ? "border-cyan-300/40 text-cyan-300" : "border-white/15 text-white/25"}`}>{selected.includes(value) ? "✓" : ""}</span>{value}</button>)}</div>; }
