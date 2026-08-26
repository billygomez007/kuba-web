"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { COUNTRY_ORDER, CURRENCY_ORDER, SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, isValidTimezone, type CountryCode, type CurrencyCode } from "@/lib/localization/registry";

type Role = { type: string; name: string; description: string };
const roles: Role[] = [
  { type: "receptionist", name: "AI Receptionist", description: "Customer enquiries, appointments, and phone calls." },
  { type: "sales", name: "AI Sales Assistant", description: "Lead qualification and sales follow-up." },
  { type: "customer-support", name: "AI Customer Support", description: "Customer issues, troubleshooting, and escalation." },
  { type: "general-manager", name: "AI Executive Assistant", description: "Internal productivity and operational priorities." },
];
const steps = ["Welcome", "Business information", "Setup choice", "First AI employee", "Business training", "Channels", "Voice setup", "Automations", "Test employee", "Ready to deploy"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); const [businessName, setBusinessName] = useState(""); const [industry, setIndustry] = useState("Professional Services"); const [countryCode, setCountryCode] = useState<CountryCode>("GH"); const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(SUPPORTED_COUNTRIES.GH.defaultCurrency); const [timezone, setTimezone] = useState(SUPPORTED_COUNTRIES.GH.defaultTimezone); const [timezoneTouched, setTimezoneTouched] = useState(false);
  // Browser timezone is read once (synchronously, no permission prompt) as a
  // SUGGESTION only — never applied automatically. See applyDetectedTimezone.
  const [detectedTimezone] = useState(() => { try { const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone; return browserZone && isValidTimezone(browserZone) ? browserZone : ""; } catch { return ""; } });
  const [location, setLocation] = useState(""); const [website, setWebsite] = useState(""); const [description, setDescription] = useState(""); const [products, setProducts] = useState(""); const [customers, setCustomers] = useState(""); const [role, setRole] = useState(roles[0]); const [employeeId, setEmployeeId] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");

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
  async function next() { setError(""); if (step === 2 && !businessName.trim()) { setError("Business name is required."); return; } setLoading(true); try { if (step === 2) await createBusiness(); if (step === 5) await saveBrain(); if (step === 4) await createEmployee(); if (step === 3) { setStep(4); setLoading(false); return; } setStep((current) => Math.min(10, current + 1)); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to continue setup."); } finally { setLoading(false); } }
  function skip() { router.push("/dashboard"); }
  async function deploy() { if (!employeeId) { setError("Create an AI employee before deploying."); return; } setLoading(true); const response = await fetch("/api/workforce/deployment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId }) }); const data = await response.json(); if (!response.ok) setError(data.error || "Complete the readiness steps before deploying."); else router.push("/dashboard"); setLoading(false); }

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

          {step === 4 && (
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

          {step === 5 && (
            <div className="mt-6 space-y-4">
              <Field label="Business description" value={description} onChange={setDescription} />
              <Field label="Products and services" value={products} onChange={setProducts} />
              <Field label="Target customers" value={customers} onChange={setCustomers} />
            </div>
          )}

          {step > 5 && step < 10 && (
            <div className="mt-6">
              <Checklist
                items={[
                  "Configure this section later from dashboard settings",
                  "No required blocking actions in this step",
                ]}
              />
            </div>
          )}

          {step === 10 && (
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

          {step !== 3 && step !== 10 && (
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
function Heading({ title }: { title: string }) { return <><h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">{title}</h1></>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Checklist({ items }: { items: string[] }) { return <div className="mt-7 space-y-3">{items.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><span className="h-2 w-2 rounded-full bg-cyan-300" />{item}<span className="ml-auto text-xs text-white/30">Configure later</span></div>)}</div>; }
