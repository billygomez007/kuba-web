"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function OnboardingPage() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          phone,
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
              <Image
                src="/brand/superkuba-logo.png"
                alt="SuperKuba"
                width={2131}
                height={738}
                priority
                className="h-auto w-[195px] object-contain transition duration-300 group-hover:scale-[1.02] sm:w-[215px]"
              />
            </Link>
          </div>

          {/* Introduction */}
          <div className="mb-9 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
              Welcome to SuperKuba
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Let&apos;s build your AI workforce.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
              Tell SuperKuba a little about your business. We&apos;ll use this
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
                  This is the business SuperKuba will build the AI workforce for.
                </p>
              </div>

              {/* Website */}
              <div>
                <label
                  htmlFor="website"
                  className="mb-2 block text-sm font-semibold text-white/75"
                >
                  Website <span className="font-normal text-white/30">(optional)</span>
                </label>

                <input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-cyan-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-white/75"
                >
                  Phone number <span className="font-normal text-white/30">(optional)</span>
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Your business phone number"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-cyan-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-cyan-400/10"
                />
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
                  : "Continue to SuperKuba"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-7 text-center">
            <p className="text-xs leading-6 text-white/25">
              You can update your business information later from your SuperKuba
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
