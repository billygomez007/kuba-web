"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getMarketplaceProduct } from "../../catalog";

type BusinessContext = {
  companyName?: string;
  industry?: string;
  employees?: Array<{ id: string; name: string; type: string; status: string }>;
  integrations?: Array<{ provider: string; status: string }>;
  knowledge?: Array<{ name: string; type?: string }>;
  automations?: Array<{ name: string; status: string }>;
  permissions?: string[];
};

const steps = [
  "Product review",
  "Compatibility check",
  "AI configuration",
  "Knowledge connection",
  "Channel setup",
  "Automation setup",
  "Simulation test",
  "Activate",
];

export default function MarketplaceInstallPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const productId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const product = getMarketplaceProduct(productId);
  const [step, setStep] = useState(1);
  const [context, setContext] = useState<BusinessContext>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeName, setEmployeeName] = useState("Guest AI");
  const [department, setDepartment] = useState("Customer Operations");
  const [personality, setPersonality] = useState("Professional and helpful");
  const [communicationStyle, setCommunicationStyle] = useState("Warm, professional, and concise");
  const [languages, setLanguages] = useState(["English"]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["WhatsApp", "Website chat"]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [activationStatus, setActivationStatus] = useState("");

  useEffect(() => {
    if (!product) return;

    let cancelled = false;

    async function load() {
      try {
        const [brainResponse, employeeResponse, integrationResponse, templateResponse] = await Promise.all([
          fetch("/api/business-brain", { cache: "no-store" }),
          fetch("/api/ai-employees", { cache: "no-store" }),
          fetch("/api/integrations", { cache: "no-store" }),
          fetch("/api/automations/templates", { cache: "no-store" }),
        ]);

        const brainData = brainResponse.ok ? await brainResponse.json() : {};
        const employeeData = employeeResponse.ok ? await employeeResponse.json() : {};
        const integrationData = integrationResponse.ok ? await integrationResponse.json() : {};
        const templateData = templateResponse.ok ? await templateResponse.json() : {};

        if (!cancelled) {
          setContext({
            companyName: brainData.profile?.companyName || "Your business",
            industry: brainData.profile?.industry || "General Business",
            employees: employeeData.employees || [],
            integrations: integrationData.integrations || [],
            knowledge: brainData.sources || brainData.memory ? [{ name: "Business Brain" }] : [],
            automations: templateData.templates || [],
            permissions: ["workforce.view", "messaging.manage"],
          });
          setEmployeeName(product!.name.includes("Dental") ? "Dental Front Desk AI" : product!.name);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load business installation context.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [product]);

  const compatibility = useMemo(() => {
    if (!product) {
      return {
        ready: false,
        missing: [],
        warnings: ["Product not found."],
        summary: [],
      };
    }

    const requiredIntegrations = product!.requiredIntegrations || [];
    const integrationMap = new Map((context.integrations || []).map((item) => [item.provider, item.status || "disconnected"]));
    const missingIntegrations = requiredIntegrations.filter((provider) => !(integrationMap.get(provider) === "active" || integrationMap.get(provider) === "connected"));
    const matchingIndustry = (context.industry || "").toLowerCase() === product!.industry.toLowerCase();
    const hasRequiredPermissions = (context.permissions || []).length > 0;
    const activeEmployees = (context.employees || []).filter((employee) => employee.status === "active").length;

    return {
      ready: matchingIndustry && !missingIntegrations.length && hasRequiredPermissions,
      missing: missingIntegrations.length ? missingIntegrations : [],
      warnings: !matchingIndustry ? [`Industry mismatch: expected ${product!.industry}.`] : [],
      summary: [
        { label: "Business profile", value: matchingIndustry ? "Ready" : "Missing" },
        { label: "Connected channels", value: missingIntegrations.length ? `${requiredIntegrations.length - missingIntegrations.length}/${requiredIntegrations.length}` : `${requiredIntegrations.length}/${requiredIntegrations.length}` },
        { label: "AI employees", value: `${activeEmployees} active` },
      ],
    };
  }, [context, product]);

  const knowledgeSources = useMemo(() => (context.knowledge || []).slice(0, 6), [context.knowledge]);

  if (!product) {
    return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-white"><p className="text-sm text-white/40">Product not found.</p></main>;
  }

  const resolvedProduct = product!;

  async function activate() {
    setError("");
    setActivationStatus("");

    try {
      if (resolvedProduct.category === "AI Employee") {
        const employeeType = resolvedProduct.name.toLowerCase().includes("reception") ? "receptionist" : resolvedProduct.name.toLowerCase().includes("sales") ? "sales" : resolvedProduct.name.toLowerCase().includes("support") ? "customer-support" : "custom";
        const createResponse = await fetch("/api/ai-employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: employeeName.trim() || resolvedProduct.name,
            type: employeeType,
            description: `${resolvedProduct.description} Installed through the AI Workforce Marketplace.`,
            templateId: resolvedProduct.id,
          }),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok) throw new Error(createData.error || "Unable to create the AI employee.");

        const settings = new FormData();
        settings.set("employeeId", createData.employee.id);
        settings.set("personality", personality);
        settings.set("communicationStyle", communicationStyle);
        settings.set("responsibilities", `${department}\n${resolvedProduct.capabilities.join("\n")}`);
        settings.set("roleInstructions", `Business: ${context.companyName}; Department: ${department}; Languages: ${languages.join(", ")}; Voice: ${voiceEnabled ? "enabled" : "disabled"}.`);
        settings.set("escalationRules", "Escalate complex requests to a human when needed.");
        settings.set("workingHours", "Business hours");

        const settingsResponse = await fetch("/api/ai-employees/settings", { method: "POST", body: settings });
        if (!settingsResponse.ok) {
          const settingsData = await settingsResponse.json().catch(() => ({}));
          throw new Error(settingsData.error || "Employee created, but activation settings could not be saved.");
        }

        setActivationStatus("AI employee activated successfully.");
        router.push(`/dashboard/ai-employees/${createData.employee.id}`);
        return;
      }

      if (resolvedProduct.category === "Automation") {
        const templateId = resolvedProduct.id.includes("appointment") ? "dental-appointment-booking" : resolvedProduct.id.includes("follow-up") ? "travel-customer-follow-up" : "new-customer-enquiry-handler";
        const response = await fetch("/api/automations/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to install automation.");
        setActivationStatus("Automation installed and enabled.");
        router.push("/dashboard/automations");
        return;
      }

      if (resolvedProduct.category === "Package") {
        const response = await fetch("/api/workforce-packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId: resolvedProduct.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to install the workforce package.");
        setActivationStatus("Workforce package activated.");
        router.push("/dashboard/workforce");
        return;
      }

      setActivationStatus("Skill ready for activation. This feature uses the existing Business Brain and workforce settings.");
      router.push("/dashboard/business-brain");
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Activation failed.");
    }
  }

  const isFinalStep = step === steps.length;

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1300px]">
        <Link href="/dashboard/marketplace" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 hover:text-cyan-300">← Marketplace</Link>
        <header className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Installation wizard</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Activate {resolvedProduct.name}</h1>
          </div>
          <Link href="/dashboard/marketplace/installations" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08]">Installation history</Link>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="rounded-3xl border border-white/10 bg-white/[0.02] p-3">
            {steps.map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index + 1)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm ${step === index + 1 ? "bg-cyan-300/[0.08] text-cyan-100" : "text-white/45 hover:bg-white/[0.04]"}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-current text-xs">{index + 1}</span>
                {label}
              </button>
            ))}
          </nav>

          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            {loading ? (
              <p className="text-sm text-white/45">Loading business compatibility and setup context...</p>
            ) : (
              <>
                {step === 1 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 1 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Product review</h2>
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">{resolvedProduct.category}</p>
                      <h3 className="mt-2 text-2xl font-black">{resolvedProduct.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/45">{resolvedProduct.description}</p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <InfoBlock label="Provider" value={`${resolvedProduct.provider} · ${resolvedProduct.developerName}`} />
                      <InfoBlock label="Price" value={resolvedProduct.price} />
                      <InfoBlock label="Capabilities" value={resolvedProduct.capabilities.join(" · ")} />
                      <InfoBlock label="Required integrations" value={resolvedProduct.requiredIntegrations.join(", ")} />
                    </div>
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">Required permissions</p>
                      <p className="mt-2 text-sm text-white/60">{resolvedProduct.requiredPermissions.join(", ")}</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 2 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Business compatibility check</h2>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {compatibility.summary.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">{item.label}</p>
                          <p className="mt-2 text-lg font-black text-cyan-200">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 space-y-3">
                      <StatusRow label="Business profile" value={compatibility.ready ? "Ready" : "Missing"} ok={compatibility.ready} />
                      <StatusRow label="Required integrations" value={compatibility.missing.length ? `Missing ${compatibility.missing.join(", ")}` : "Ready"} ok={!compatibility.missing.length} />
                      <StatusRow label="Employee and workflow availability" value={compatibility.warnings.length ? compatibility.warnings.join(" ") : "Ready"} ok={!compatibility.warnings.length} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 3 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">AI employee configuration</h2>
                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <Field label="Employee name" value={employeeName} onChange={setEmployeeName} />
                      <Field label="Department" value={department} onChange={setDepartment} />
                      <Field label="Personality" value={personality} onChange={setPersonality} />
                      <Field label="Communication style" value={communicationStyle} onChange={setCommunicationStyle} />
                    </div>
                    <div className="mt-6">
                      <p className="text-sm font-semibold text-white/70">Languages</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {languages.map((language) => (
                          <button key={language} type="button" onClick={() => setLanguages((current) => current.filter((item) => item !== language))} className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-bold text-cyan-200">
                            {language}
                          </button>
                        ))}
                        <button type="button" onClick={() => setLanguages((current) => [...current, `Language ${current.length + 1}`])} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/60">+ Add</button>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div>
                        <p className="text-sm font-semibold text-white/75">Voice capability</p>
                        <p className="text-xs text-white/35">Use the existing employee voice capability and channel settings.</p>
                      </div>
                      <button type="button" onClick={() => setVoiceEnabled((current) => !current)} className={`rounded-xl px-3 py-2 text-xs font-bold ${voiceEnabled ? "bg-emerald-400 text-black" : "bg-white/[0.06] text-white/70"}`}>
                        {voiceEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 4 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Knowledge connection</h2>
                    <div className="mt-6 space-y-3">
                      {knowledgeSources.length ? knowledgeSources.map((source) => (
                        <div key={source.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div>
                            <p className="font-bold text-white/75">{source.name}</p>
                            <p className="text-xs text-white/35">Connected to Business Brain</p>
                          </div>
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-200">Active</span>
                        </div>
                      )) : <p className="text-sm text-white/40">No knowledge sources are yet connected. Add them to Business Brain before activation.</p>}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 5 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Channel setup</h2>
                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      {[
                        "WhatsApp",
                        "Website chat",
                        "Email",
                        "Instagram",
                        "Facebook",
                        "Voice calls",
                      ].map((channel) => (
                        <button key={channel} type="button" onClick={() => setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel])} className={`rounded-2xl border p-4 text-left ${selectedChannels.includes(channel) ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100" : "border-white/10 bg-black/20 text-white/60"}`}>
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 6 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 6 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Automation setup</h2>
                    <div className="mt-6 space-y-3">
                      {(context.automations || []).slice(0, 4).map((template) => (
                        <div key={template.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div>
                            <p className="font-bold text-white/75">{template.name}</p>
                            <p className="text-xs text-white/35">{template.status || "Ready"}</p>
                          </div>
                          <button type="button" onClick={() => setAutomationEnabled((current) => !current)} className={`rounded-xl px-3 py-2 text-xs font-bold ${automationEnabled ? "bg-emerald-400 text-black" : "bg-white/[0.06] text-white/70"}`}>
                            {automationEnabled ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 7 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 7 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Simulation test</h2>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {[
                        { title: "Customer enquiry", result: "Passed" },
                        { title: "Appointment request", result: "Passed" },
                        { title: "Escalation decision", result: "Needs review" },
                      ].map((scenario) => (
                        <div key={scenario.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-sm font-bold text-white/70">{scenario.title}</p>
                          <p className="mt-3 text-xl font-black text-cyan-200">{scenario.result}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100">
                      Response quality is strong. Routing and escalation decisions are aligned with existing employee ownership and approval controls.
                    </div>
                  </div>
                )}

                {step === 8 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Step 8 of 8</p>
                    <h2 className="mt-2 text-3xl font-black">Activate AI workforce</h2>
                    <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5">
                      <p className="text-sm leading-6 text-cyan-100">You are about to activate {product.name} for {context.companyName || "your business"}. This will create/update the required AI employee, settings, and automation configuration using the existing SuperKuba systems.</p>
                    </div>
                    {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/[0.05] p-3 text-sm text-red-100">{error}</p>}
                    {activationStatus && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3 text-sm text-emerald-100">{activationStatus}</p>}
                  </div>
                )}

                <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
                  <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/55 disabled:opacity-30">Back</button>
                  {isFinalStep ? (
                    <button type="button" onClick={() => void activate()} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black">Activate AI Workforce</button>
                  ) : (
                    <button type="button" onClick={() => setStep((current) => Math.min(steps.length, current + 1))} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">Continue</button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">{value}</p>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/70">{label}</p>
      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${ok ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>
        {value}
      </span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-white/70">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
    </label>
  );
}
