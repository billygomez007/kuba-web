"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const africanCountries = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Democratic Republic of the Congo",
  "Republic of the Congo",
  "Côte d'Ivoire",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "The Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "São Tomé and Príncipe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
];

const otherCountries = [
  "Canada",
  "United Kingdom",
  "United States",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();

  function readSavedOnboardingData() {
    if (typeof window === "undefined") {
      return { businessName: "", website: "" };
    }

    try {
      const saved = sessionStorage.getItem("kuba_onboarding_data");

      if (!saved) {
        return { businessName: "", website: "" };
      }

      const data = JSON.parse(saved);

      return {
        businessName:
          typeof data.businessName === "string" ? data.businessName : "",
        website: typeof data.website === "string" ? data.website : "",
      };
    } catch {
      sessionStorage.removeItem("kuba_onboarding_data");
      return { businessName: "", website: "" };
    }
  }

  const [businessName, setBusinessName] = useState(
    () => readSavedOnboardingData().businessName,
  );
  const [website, setWebsite] = useState(
    () => readSavedOnboardingData().website,
  );
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("Ghana");
  const [businessSize, setBusinessSize] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredAfricanCountries = useMemo(() => {
    const search = countrySearch.trim().toLowerCase();

    if (!search) {
      return africanCountries;
    }

    return africanCountries.filter((name) =>
      name.toLowerCase().includes(search),
    );
  }, [countrySearch]);

  const filteredOtherCountries = useMemo(() => {
    const search = countrySearch.trim().toLowerCase();

    if (!search) {
      return otherCountries;
    }

    return otherCountries.filter((name) =>
      name.toLowerCase().includes(search),
    );
  }, [countrySearch]);

  function selectCountry(name: string) {
    setCountry(name);
    setCountrySearch("");
    setCountryOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName,
          website,
          industry,
          country,
          businessSize,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create your business.");
      }

      router.push("/onboarding/business-training");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your business.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[550px] w-[550px] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute -right-40 top-10 h-[550px] w-[550px] rounded-full bg-violet-600/10 blur-[160px]" />
        <div className="absolute bottom-[-300px] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/5 blur-[170px]" />
      </div>

      <div className="relative min-h-screen px-6 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-2xl">

          {/* Kuba Brand */}
          <div className="mb-10 flex justify-center">
            <Link href="/" className="group">
              <img
                src="/brand/kuba-logo-3d.png"
                alt="Kuba AI"
                className="h-auto w-[210px] object-contain transition duration-300 group-hover:scale-[1.02]"
              />
            </Link>
          </div>

          {/* Introduction */}
          <div className="mb-9 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
              Welcome to Kuba
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Let&apos;s build your AI workforce.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
              Tell Kuba a little about your business. We&apos;ll use this
              information to prepare the right AI workforce for your
              operations.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-5 flex items-center gap-3 px-1">
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

            <span className="text-[11px] font-semibold text-white/30">
              Step 1 of 1
            </span>
          </div>

          {/* Form Card */}
          <div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Business Name */}
              <div>
                <label
                  htmlFor="businessName"
                  className="mb-2 block text-sm font-semibold text-white/75"
                >
                  Business name
                </label>

                <input
                  id="businessName"
                  type="text"
                  required
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Your company name"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-cyan-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-cyan-400/10"
                />

                <p className="mt-2 text-xs text-white/25">
                  This is the business Kuba will build the AI workforce for.
                </p>
              </div>

              {/* Industry */}
              <div>
                <label
                  htmlFor="industry"
                  className="mb-2 block text-sm font-semibold text-white/75"
                >
                  Industry
                </label>

                <select
                  id="industry"
                  required
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
                >
                  <option value="">Select your industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Retail">Retail</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Travel & Tourism">Travel & Tourism</option>
                  <option value="Education">Education</option>
                  <option value="Professional Services">
                    Professional Services
                  </option>
                  <option value="Logistics">Logistics</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Country + Business Size */}
              <div className="grid gap-6 sm:grid-cols-2">

                {/* Country */}
                <div className="relative">
                  <label
                    htmlFor="country"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Country
                  </label>

                  <button
                    type="button"
                    onClick={() => setCountryOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-left text-sm text-white outline-none transition hover:bg-white/[0.06] focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
                  >
                    <span>{country || "Select your country"}</span>

                    <span
                      className={`text-white/40 transition-transform ${
                        countryOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {countryOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0f] shadow-2xl shadow-black/60">

                      {/* Search */}
                      <div className="border-b border-white/[0.07] p-3">
                        <input
                          autoFocus
                          type="text"
                          value={countrySearch}
                          onChange={(event) =>
                            setCountrySearch(event.target.value)
                          }
                          placeholder="Search countries..."
                          className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/50"
                        />
                      </div>

                      {/* Country list */}
                      <div className="max-h-64 overflow-y-auto p-2">

                        {filteredAfricanCountries.length > 0 && (
                          <>
                            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/60">
                              Africa
                            </p>

                            {filteredAfricanCountries.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => selectCountry(name)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                  country === name
                                    ? "bg-cyan-400/10 text-cyan-300"
                                    : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                                }`}
                              >
                                <span>{name}</span>

                                {country === name && (
                                  <span className="text-xs">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        {filteredOtherCountries.length > 0 && (
                          <>
                            <div className="my-2 border-t border-white/[0.06]" />

                            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                              Other countries
                            </p>

                            {filteredOtherCountries.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => selectCountry(name)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                  country === name
                                    ? "bg-cyan-400/10 text-cyan-300"
                                    : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                                }`}
                              >
                                <span>{name}</span>

                                {country === name && (
                                  <span className="text-xs">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        {filteredAfricanCountries.length === 0 &&
                          filteredOtherCountries.length === 0 && (
                            <div className="px-3 py-8 text-center text-sm text-white/30">
                              No country found.
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-xs text-white/25">
                    Where your business operates.
                  </p>
                </div>

                {/* Business Size */}
                <div>
                  <label
                    htmlFor="businessSize"
                    className="mb-2 block text-sm font-semibold text-white/75"
                  >
                    Business size
                  </label>

                  <select
                    id="businessSize"
                    required
                    value={businessSize}
                    onChange={(event) => setBusinessSize(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="11-50">11–50 employees</option>
                    <option value="51-200">51–200 employees</option>
                    <option value="201-500">201–500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Continue */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.01] hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Setting up your business..."
                  : "Continue to Kuba"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-7 text-center">
            <p className="text-xs leading-6 text-white/25">
              You can update your business information later from your Kuba
              settings.
            </p>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/15">
              AI Workforce for the Future
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
