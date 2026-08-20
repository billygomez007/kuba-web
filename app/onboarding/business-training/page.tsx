"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BusinessTrainingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    await fetch("/api/businesses/ai-settings", {
      method: "POST",
      body: formData,
    });

    router.push("/onboarding/ai-training");
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <h1 className="text-3xl font-black">
          Teach Kuba About Your Business
        </h1>

        <p className="mt-3 text-white/50">
          Help Kuba understand your company before building your AI workforce.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">

          <textarea name="businessDescription" required placeholder="Describe your business..." className="w-full rounded-xl bg-black/30 p-4" />

          <textarea name="productsAndServices" required placeholder="Products and services you offer..." className="w-full rounded-xl bg-black/30 p-4" />

          <textarea name="targetCustomers" required placeholder="Who are your customers?" className="w-full rounded-xl bg-black/30 p-4" />

          <textarea name="frequentlyAskedQuestions" placeholder="Frequently asked customer questions..." className="w-full rounded-xl bg-black/30 p-4" />

          <textarea name="aiInstructions" placeholder="How should Kuba represent your business?" className="w-full rounded-xl bg-black/30 p-4" />

          <input type="hidden" name="tone" value="professional" />

          <button
            disabled={loading}
            className="rounded-xl bg-white px-8 py-4 font-bold text-black"
          >
            {loading ? "Saving..." : "Continue"}
          </button>

        </form>

      </div>
    </main>
  );
}
