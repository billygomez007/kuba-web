"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import BackNavigation from "../components/BackNavigation";

export default function ContactSalesPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to send your message.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Unable to send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <BackNavigation className="mb-8" label="Back to SuperKuba" />

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Talk to SuperKuba Sales</h1>
          <p className="mt-3 text-white/50">
            Enterprise plans aren&apos;t self-serve. Tell us about your
            business and we&apos;ll follow up to design the right setup.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          {submitted ? (
            <div className="text-center">
              <p className="text-lg font-semibold">Message sent.</p>
              <p className="mt-2 text-sm text-white/60">
                Thanks for reaching out. Our team will follow up at the email
                address you provided.
              </p>
              <Link href="/" className="mt-6 inline-block text-cyan-300">
                Return to SuperKuba
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3"
              />

              <input
                required
                placeholder="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3"
              />

              <input
                required
                placeholder="Company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3"
              />

              <textarea
                required
                placeholder="What are you looking to do with SuperKuba?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-white/10 px-4 py-3"
              />

              {error && (
                <div className="rounded-xl bg-red-500/20 p-3 text-red-300">
                  {error}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 py-3 font-bold disabled:opacity-60"
              >
                {loading ? "Sending..." : "Contact Sales"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
