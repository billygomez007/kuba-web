"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "welcome" | "business" | "employee" | "success";
type Business = { id: string; name: string };
type Employee = { id: string; name: string; status: string };

const industries = ["Travel", "Healthcare", "Real Estate", "Education", "Retail", "Professional Services", "Other"];
const sizes = ["Solo", "2-10 employees", "11-50 employees", "51-200 employees", "200+"];
const goals = ["Get more customers", "Automate customer support", "Improve sales follow-up", "Reduce repetitive work", "Manage operations", "Improve response time"];
const employees = [
  { type: "receptionist", name: "AI Receptionist", description: "Handles customer enquiries, answers questions, and captures leads." },
  { type: "sales", name: "AI Sales Assistant", description: "Qualifies leads and follows up." },
  { type: "customer-support", name: "AI Support Agent", description: "Handles customer support." },
];
const draftKey = "superkuba:onboarding-business-draft";

type OnboardingDraft = {
  companyName: string;
  industry: string;
  businessSize: string;
  goals: string[];
};

function readDraft(): OnboardingDraft {
  if (typeof window === "undefined") {
    return {
      companyName: "",
      industry: "",
      businessSize: "",
      goals: [],
    };
  }

  const saved = window.localStorage.getItem(draftKey);

  if (!saved) {
    return {
      companyName: "",
      industry: "",
      businessSize: "",
      goals: [],
    };
  }

  try {
    const draft = JSON.parse(saved) as Partial<OnboardingDraft>;

    return {
      companyName: typeof draft.companyName === "string" ? draft.companyName : "",
      industry: typeof draft.industry === "string" ? draft.industry : "",
      businessSize: typeof draft.businessSize === "string" ? draft.businessSize : "",
      goals: Array.isArray(draft.goals) ? draft.goals.filter((goal): goal is string => typeof goal === "string") : [],
    };
  } catch {
    window.localStorage.removeItem(draftKey);

    return {
      companyName: "",
      industry: "",
      businessSize: "",
      goals: [],
    };
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [initialDraft] = useState<OnboardingDraft>(readDraft);
  const [stage, setStage] = useState<Stage>("welcome");
  const [business, setBusiness] = useState<Business | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [companyName, setCompanyName] = useState(initialDraft.companyName);
  const [industry, setIndustry] = useState(initialDraft.industry);
  const [businessSize, setBusinessSize] = useState(initialDraft.businessSize);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initialDraft.goals);
  const [selectedEmployee, setSelectedEmployee] = useState("receptionist");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProgress() {
      try {
        const response = await fetch("/api/businesses", { cache: "no-store" });
        if (response.status === 401) return router.replace("/login?callbackUrl=/onboarding");
        if (response.status === 404) return;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load onboarding.");
        setBusiness(data.business);
        if (data.employees?.length) return router.replace("/dashboard");
        setStage("employee");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load onboarding.");
      } finally {
        setLoading(false);
      }
    }

    void loadProgress();
  }, [router]);

  useEffect(() => {
    if (!loading && !business) {
      window.localStorage.setItem(draftKey, JSON.stringify({ companyName, industry, businessSize, goals: selectedGoals }));
    }
  }, [business, businessSize, companyName, industry, loading, selectedGoals]);

  function toggleGoal(goal: string) {
    setSelectedGoals((current) => current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]);
  }

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!industry || !businessSize || !selectedGoals.length) {
      return setError("Choose an industry, business size, and at least one main goal.");
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: companyName, industry, businessSize, goals: selectedGoals }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your business.");
      setBusiness({ id: data.businessId, name: companyName.trim() });
      window.localStorage.removeItem(draftKey);
      setStage("employee");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your business.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createEmployee() {
    const employee = employees.find((item) => item.type === selectedEmployee);
    if (!employee) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/ai-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employee),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create your AI employee.");
      setCreatedEmployee(data.employee);
      setStage("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your AI employee.");
    } finally {
      setSubmitting(false);
    }
  }

  const step = { welcome: 1, business: 2, employee: 3, success: 4 }[stage];

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white"><div className="text-center"><Image src="/brand/superkuba-logo.png" alt="SuperKuba" width={2131} height={738} priority className="h-auto w-48" /><p className="mt-6 text-sm text-white/45">Preparing your workspace…</p></div></main>;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] px-5 py-8 text-white sm:px-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0"><div className="absolute -left-40 -top-40 h-[540px] w-[540px] rounded-full bg-cyan-500/10 blur-[150px]" /><div className="absolute -right-40 top-20 h-[560px] w-[560px] rounded-full bg-violet-600/10 blur-[160px]" /></div>
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between"><Link href="/" aria-label="SuperKuba homepage"><Image src="/brand/superkuba-logo.png" alt="SuperKuba" width={2131} height={738} priority className="h-auto w-44 sm:w-52" /></Link><span className="text-xs font-semibold text-white/35">Step {step} of 4</span></div>
        <div className="mt-6 grid grid-cols-4 gap-2">{[1,2,3,4].map((item) => <div key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-gradient-to-r from-cyan-400 to-violet-500" : "bg-white/10"}`} />)}</div>

        <section className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10 lg:p-12">
          {stage === "welcome" && <div className="mx-auto max-w-2xl py-8 text-center sm:py-14"><span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Your workspace is ready</span><h1 className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">Welcome to SuperKuba AI</h1><p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/55 sm:text-lg">Your AI workforce is ready to help automate your business.</p><button onClick={() => setStage("business")} className="mt-9 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-9 py-4 text-sm font-bold shadow-lg shadow-blue-500/25 transition hover:scale-[1.02]">Get Started</button></div>}

          {stage === "business" && <form onSubmit={saveBusiness}><Eyebrow>Business setup</Eyebrow><Title>Tell us about your business</Title><Description>We’ll personalize your first AI employee around how your business works.</Description><div className="mt-8 grid gap-6 sm:grid-cols-2"><Field label="Company name" className="sm:col-span-2"><input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Your company name" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 font-normal outline-none focus:border-cyan-400/60" /></Field><Field label="Industry"><select required value={industry} onChange={(event) => setIndustry(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3.5 font-normal outline-none focus:border-cyan-400/60"><option value="">Select an industry</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Business size"><select required value={businessSize} onChange={(event) => setBusinessSize(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3.5 font-normal outline-none focus:border-cyan-400/60"><option value="">Select business size</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select></Field></div><fieldset className="mt-7"><legend className="text-sm font-semibold text-white/75">What would you like SuperKuba to help with?</legend><p className="mt-1 text-xs text-white/35">Select all that apply.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{goals.map((goal) => { const selected = selectedGoals.includes(goal); return <button key={goal} type="button" aria-pressed={selected} onClick={() => toggleGoal(goal)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25"}`}>{selected ? "✓ " : ""}{goal}</button>; })}</div></fieldset><ErrorMessage message={error} /><PrimaryButton loading={submitting} loadingText="Saving your business…">Continue</PrimaryButton></form>}

          {stage === "employee" && <div><Eyebrow>Build your workforce</Eyebrow><Title>Let&apos;s create your first AI employee</Title><Description>Choose an AI employee to start building your AI workforce.</Description><div className="mt-8 grid gap-4 md:grid-cols-3">{employees.map((employee) => { const selected = employee.type === selectedEmployee; return <button key={employee.type} type="button" onClick={() => setSelectedEmployee(employee.type)} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-500/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}><div className="h-1.5 w-14 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" /><h2 className="mt-6 text-lg font-bold">{employee.name}</h2><p className="mt-3 text-sm leading-6 text-white/45">{employee.description}</p><p className={`mt-6 text-xs font-bold uppercase tracking-wider ${selected ? "text-cyan-300" : "text-white/25"}`}>{selected ? "✓ Selected" : "Select"}</p></button>; })}</div><ErrorMessage message={error} /><button onClick={createEmployee} disabled={submitting} className="mt-8 w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-5 py-4 text-sm font-bold disabled:opacity-60">{submitting ? "Creating your AI employee…" : "Create AI Employee"}</button></div>}

          {stage === "success" && <div className="mx-auto max-w-2xl py-6 text-center sm:py-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-2xl text-emerald-300">✓</div><h1 className="mt-6 text-4xl font-black">Your AI workforce is ready.</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-white/50">SuperKuba is now ready to help your business work smarter.</p><div className="mt-8 grid gap-3 text-left sm:grid-cols-2"><Summary label="Business" value={business?.name || "Your business"} /><Summary label="AI employee" value={createdEmployee?.name || "AI employee"} detail={createdEmployee?.status} /></div><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left"><p className="text-sm font-bold">Recommended next actions</p><p className="mt-2 text-sm leading-6 text-white/45">Teach your AI employee about your services, connect a customer channel, and review its supervision settings.</p></div><button onClick={() => router.push("/dashboard")} className="mt-8 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-9 py-4 text-sm font-bold shadow-lg shadow-blue-500/25">Go to Dashboard</button></div>}
        </section>
      </div>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">{children}</p>; }
function Title({ children }: { children: React.ReactNode }) { return <h1 className="mt-3 text-3xl font-black sm:text-4xl">{children}</h1>; }
function Description({ children }: { children: React.ReactNode }) { return <p className="mt-3 text-white/50">{children}</p>; }
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`text-sm font-semibold text-white/75 ${className}`}>{label}{children}</label>; }
function ErrorMessage({ message }: { message: string }) { return message ? <p className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{message}</p> : null; }
function PrimaryButton({ loading, loadingText, children }: { loading: boolean; loadingText: string; children: React.ReactNode }) { return <button disabled={loading} className="mt-8 w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-5 py-4 text-sm font-bold disabled:opacity-60">{loading ? loadingText : children}</button>; }
function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-5"><p className="text-xs uppercase tracking-wider text-white/30">{label}</p><p className="mt-2 font-bold">{value}</p>{detail && <p className="mt-1 text-xs capitalize text-emerald-300">{detail}</p>}</div>; }
