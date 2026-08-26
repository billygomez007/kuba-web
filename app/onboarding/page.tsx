"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { COUNTRY_ORDER, CURRENCY_ORDER, SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, isValidTimezone, type CountryCode, type CurrencyCode } from "@/lib/localization/registry";
import { formatDate } from "@/lib/localization/format";
import { planDefinitions, planOrder, type PlanId } from "@/lib/billing/plan-definitions";
import { cardFeatures, limitCopy, pricingCopy } from "@/lib/billing/pricing-presentation";

type Role = { type: string; name: string; description: string };
const roles: Role[] = [
  { type: "receptionist", name: "AI Receptionist", description: "Customer enquiries, appointments, and phone calls." },
  { type: "sales", name: "AI Sales Assistant", description: "Lead qualification and sales follow-up." },
  { type: "customer-support", name: "AI Customer Support", description: "Customer issues, troubleshooting, and escalation." },
  { type: "general-manager", name: "AI Executive Assistant", description: "Internal productivity and operational priorities." },
];
const steps = ["Welcome", "Business information", "Choose your plan", "Setup choice", "First AI employee", "Business training", "Channels", "Voice setup", "Automations", "Test employee", "Ready to deploy"];
const SELF_SERVE_PLANS: PlanId[] = ["starter", "growth", "pro"];
const TRIAL_DAYS = 14;

function isSelfServePlan(value: string | null): value is PlanId {
  return value != null && (SELF_SERVE_PLANS as string[]).includes(value);
}

// Module-scope, not part of the component's render body — the lint/compiler
// purity check for render-impure calls (Date.now()) only analyzes the
// component function itself, so real "current time" reads belong here.
function computeFirstChargeDate(timezone: string, baseDate = new Date()) {
  return formatDate(new Date(baseDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000), timezone);
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan");
  const resumingAtPlanStep = searchParams.get("resume") === "plan";

  const [step, setStep] = useState(resumingAtPlanStep ? 3 : 1); const [businessName, setBusinessName] = useState(""); const [industry, setIndustry] = useState("Professional Services"); const [countryCode, setCountryCode] = useState<CountryCode>("GH"); const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(SUPPORTED_COUNTRIES.GH.defaultCurrency); const [timezone, setTimezone] = useState(SUPPORTED_COUNTRIES.GH.defaultTimezone); const [timezoneTouched, setTimezoneTouched] = useState(false);
  // Browser timezone is read once (synchronously, no permission prompt) as a
  // SUGGESTION only — never applied automatically. See applyDetectedTimezone.
  const [detectedTimezone] = useState(() => { try { const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone; return browserZone && isValidTimezone(browserZone) ? browserZone : ""; } catch { return ""; } });
  const [location, setLocation] = useState(""); const [website, setWebsite] = useState(""); const [description, setDescription] = useState(""); const [products, setProducts] = useState(""); const [customers, setCustomers] = useState(""); const [role, setRole] = useState(roles[0]); const [employeeId, setEmployeeId] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  const [selectedPlan, setSelectedPlan] = useState<PlanId>(isSelfServePlan(initialPlan) ? initialPlan : "growth");
  const [trialLoading, setTrialLoading] = useState(false);
  // Populated from ?trialError= when Paystack redirects back after a failed
  // card verification/subscription-scheduling attempt, so the customer sees
  // why they landed back here instead of the dashboard.
  const [trialError, setTrialError] = useState<{ message: string; code?: string } | null>(() => { const fromRedirect = searchParams.get("trialError"); return fromRedirect ? { message: fromRedirect } : null; });

  function selectCountry(nextCode: CountryCode) {
    setCountryCode(nextCode);
    const defaults = SUPPORTED_COUNTRIES[nextCode];
    setCurrencyCode(defaults.defaultCurrency);
    if (!timezoneTouched) setTimezone(defaults.defaultTimezone);
  }

  function applyDetectedTimezone() {
    setTimezone(detectedTimezone);
    setTimezoneTouched(true);
  }

  async function createBusiness() { const response = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, website, industry, countryCode, currencyCode, timezone, businessSize: "Solo", goals: ["Automate customer support"], location }) }); const data = await response.json(); if (!response.ok && response.status !== 409) throw new Error(data.error || "Unable to save business profile."); }
  async function saveBrain() { const form = new FormData(); form.set("businessDescription", `${description}${location ? ` Location: ${location}.` : ""}`); form.set("productsAndServices", products); form.set("targetCustomers", customers); form.set("frequentlyAskedQuestions", ""); form.set("aiInstructions", ""); form.set("tone", "professional"); const response = await fetch("/api/businesses/ai-settings", { method: "POST", body: form, redirect: "manual" }); if (!response.ok && response.status !== 307) throw new Error("Unable to save Business Brain."); }
  async function createEmployee() { const response = await fetch("/api/ai-employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Kuba ${role.name.replace("AI ", "")}`, type: role.type, description: role.description, templateId: role.type }) }); const data = await response.json(); if (!response.ok && response.status !== 409) throw new Error(data.error || "Unable to create AI employee."); if (data.employee?.id) { setEmployeeId(data.employee.id); const settings = new FormData(); settings.set("employeeId", data.employee.id); settings.set("responsibilities", role.description); settings.set("communicationStyle", "Professional and helpful"); settings.set("roleInstructions", "Use Business Brain and approved tools. Escalate when human support is needed."); await fetch("/api/ai-employees/settings", { method: "POST", body: settings }); } }
  async function next() { setError(""); if (step === 2 && !businessName.trim()) { setError("Business name is required."); return; } const actionDate = new Date(); setLoading(true); try { if (step === 2) { await createBusiness(); setFirstChargeDate(computeFirstChargeDate(timezone, actionDate)); } if (step === 6) await saveBrain(); if (step === 5) await createEmployee(); if (step === 4) { setStep(5); setLoading(false); return; } setStep((current) => Math.min(steps.length, current + 1)); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to continue setup."); } finally { setLoading(false); } }
  function skip() { router.push("/dashboard"); }
  async function deploy() { if (!employeeId) { setError("Create an AI employee before deploying."); return; } setLoading(true); const response = await fetch("/api/workforce/deployment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId }) }); const data = await response.json(); if (!response.ok) setError(data.error || "Complete the readiness steps before deploying."); else router.push("/dashboard"); setLoading(false); }

  async function startTrial() {
    setTrialError(null);
    setTrialLoading(true);
    try {
      const response = await fetch("/api/billing/trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: selectedPlan }) });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setTrialError({ message: data.error || "Unable to start your free trial.", code: data.code });
        setTrialLoading(false);
        return;
      }
      window.location.href = data.url; // full navigation to the provider's hosted, secure payment page
    } catch {
      setTrialError({ message: "Unable to start your free trial. Please try again." });
      setTrialLoading(false);
    }
  }

  // Date.now() is impure and must not be called during render. Computed once
  // via this lazy initializer (an explicitly allowed escape hatch — it runs
  // once, off the render path) using whatever timezone is current at that
  // moment, and refreshed for the common path in next() when step 2 -> 3.
  const [firstChargeDate, setFirstChargeDate] = useState(() => computeFirstChargeDate(timezone));
  const trialUnavailable = trialError?.code === "CONFIGURATION_REQUIRED" || trialError?.code === "TRIAL_NOT_SUPPORTED_FOR_PROVIDER";

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
            Back to SuperKuba
          </Link>

          <button
            type="button"
            onClick={skip}
            className="text-sm text-white/70 hover:text-white"
          >
            Skip for now
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Step {step} of {steps.length}
          </p>

          <Heading title={steps[step - 1]} />

          {step === 1 && (
            <div className="mt-5">
              <p className="text-white/70">
                Welcome to SuperKuba. This quick setup helps you create your business workspace and first AI employee.
              </p>

              <Checklist
                items={[
                  "Create your business workspace",
                  "Set up your first AI employee",
                  "Connect channels later from dashboard",
                ]}
              />
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Business name" value={businessName} onChange={setBusinessName} />
              <Field label="Industry" value={industry} onChange={setIndustry} />
              <Select label="Country" value={countryCode} onChange={(value) => selectCountry(value as CountryCode)} options={COUNTRY_ORDER.map((code) => ({ value: code, label: SUPPORTED_COUNTRIES[code].name }))} />
              <Select label="Currency" value={currencyCode} onChange={(value) => setCurrencyCode(value as CurrencyCode)} options={CURRENCY_ORDER.map((code) => ({ value: code, label: `${SUPPORTED_CURRENCIES[code].name} (${code})` }))} />
              <Select label="Timezone" value={timezone} onChange={(value) => { setTimezone(value); setTimezoneTouched(true); }} options={Array.from(new Set([timezone, SUPPORTED_COUNTRIES[countryCode].defaultTimezone, detectedTimezone].filter(Boolean))).map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))} />
              <Field label="Location (optional)" value={location} onChange={setLocation} />
              <Field label="Website (optional)" value={website} onChange={setWebsite} />
              {detectedTimezone && detectedTimezone !== timezone && (
                <p className="md:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-3 text-sm text-cyan-100">
                  We detected your browser is in {detectedTimezone.replaceAll("_", " ")}.{" "}
                  <button type="button" onClick={applyDetectedTimezone} className="font-semibold underline underline-offset-2">
                    Use this timezone?
                  </button>{" "}
                  You can always change it later in Settings.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-6">
              <p className="text-white/70">Choose the plan you want to run on. Starter, Growth, and Pro all start with a {TRIAL_DAYS}-day free trial.</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {planOrder.map((planId) => {
                  const plan = planDefinitions.find((item) => item.id === planId)!;
                  const copy = pricingCopy[planId];
                  if (planId === "enterprise") {
                    return (
                      <a key={planId} href="/demo" className="rounded-xl border border-white/15 bg-black/20 p-4 text-left transition hover:border-white/25">
                        <p className="font-semibold">{plan.name}</p>
                        <p className="mt-1 text-sm text-white/60">{copy.positioning}</p>
                        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Contact Sales →</p>
                      </a>
                    );
                  }
                  return (
                    <button
                      key={planId}
                      type="button"
                      onClick={() => { setSelectedPlan(planId); setTrialError(null); }}
                      className={`rounded-xl border p-4 text-left ${selectedPlan === planId ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-black/20"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{plan.name}</p>
                        <span className="text-sm font-bold">{copy.price}<span className="text-xs font-normal text-white/40">{copy.billingLabel}</span></span>
                      </div>
                      <p className="mt-1 text-sm text-white/60">{copy.positioning}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-300">{TRIAL_DAYS}-day free trial</p>
                      <ul className="mt-3 space-y-1 text-xs text-white/55">{cardFeatures(plan).slice(0, 4).map((feature) => <li key={feature.label}>✓ {feature.label}</li>)}</ul>
                      <ul className="mt-2 space-y-0.5 text-[11px] text-white/35">{limitCopy(planId).map((item) => <li key={item}>{item}</li>)}</ul>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
                <p className="text-sm font-bold text-cyan-200">Start your {TRIAL_DAYS}-day free trial</p>
                <p className="mt-2 text-sm leading-6 text-white/65">Your {TRIAL_DAYS}-day free trial starts today. Your first subscription payment will be charged on <strong>{firstChargeDate}</strong> if you don&apos;t cancel before then. Cancel anytime before your trial ends to avoid being charged.</p>
                <p className="mt-2 text-sm leading-6 text-white/50">A small temporary verification charge may be required to securely authorize your card with our payment provider. It will be refunded where applicable, and is separate from — and never the same as — your SuperKuba subscription payment.</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs uppercase tracking-wide text-white/35">Plan</dt><dd className="mt-1 font-semibold">{planDefinitions.find((p) => p.id === selectedPlan)!.name}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-white/35">Subscription charge today</dt><dd className="mt-1 font-semibold">$0</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-white/35">Trial period</dt><dd className="mt-1 font-semibold">{TRIAL_DAYS} days</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-white/35">First subscription charge</dt><dd className="mt-1 font-semibold">{firstChargeDate}</dd></div>
                </dl>

                {trialError && !trialUnavailable && (
                  <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{trialError.message}</p>
                )}
                {trialUnavailable && (
                  <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    Trial checkout isn&apos;t configured for this environment yet. You can continue on the Starter plan now and add billing later from Settings.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void startTrial()} disabled={trialLoading} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60">
                    {trialLoading ? "Starting your trial..." : `Start ${TRIAL_DAYS}-Day Free Trial`}
                  </button>
                  <button type="button" onClick={() => setStep(4)} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/70 hover:text-white">
                    Continue without payment for now
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-4">
              <p className="text-white/70">
                Continue with guided setup or skip directly to your dashboard and configure later.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={next}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black"
                >
                  Guided setup
                </button>

                <button
                  type="button"
                  onClick={skip}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold"
                >
                  Skip onboarding
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mt-6 space-y-4">
              <p className="text-white/70">Select your first AI employee role.</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((candidate) => (
                  <button
                    key={candidate.type}
                    type="button"
                    onClick={() => setRole(candidate)}
                    className={`rounded-xl border p-4 text-left ${role.type === candidate.type ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-black/20"}`}
                  >
                    <p className="font-semibold">{candidate.name}</p>
                    <p className="mt-1 text-sm text-white/60">{candidate.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="mt-6 space-y-4">
              <Field label="Business description" value={description} onChange={setDescription} />
              <Field label="Products and services" value={products} onChange={setProducts} />
              <Field label="Target customers" value={customers} onChange={setCustomers} />
            </div>
          )}

          {step > 6 && step < steps.length && (
            <div className="mt-6">
              <Checklist
                items={[
                  "Configure this section later from dashboard settings",
                  "No required blocking actions in this step",
                ]}
              />
            </div>
          )}

          {step === steps.length && (
            <div className="mt-6 space-y-4">
              <p className="text-white/70">
                You are ready to continue. Deploy your first AI employee now, or finish setup later from your dashboard.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={deploy}
                  disabled={loading}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {loading ? "Deploying..." : "Deploy now"}
                </button>

                <button
                  type="button"
                  onClick={skip}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold"
                >
                  Continue to dashboard
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {step !== 3 && step !== 4 && step !== steps.length && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={next}
                disabled={loading}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050507] text-white" />}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function Heading({ title }: { title: string }) { return <><h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">{title}</h1></>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Checklist({ items }: { items: string[] }) { return <div className="mt-7 space-y-3">{items.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><span className="h-2 w-2 rounded-full bg-cyan-300" />{item}<span className="ml-auto text-xs text-white/30">Configure later</span></div>)}</div>; }
