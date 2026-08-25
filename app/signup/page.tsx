"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "../../lib/auth-client";
import BackNavigation from "../components/BackNavigation";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Unable to create your account.");
      return;
    }

    await fetch("/api/email/welcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        name,
      }),
    });

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <BackNavigation className="mb-8" label="Back to SuperKuba" />

        <div className="mb-8 text-center">
          <Link href="/" aria-label="SuperKuba homepage">
            <Image
              src="/brand/superkuba-logo.png"
              alt="SuperKuba"
              width={2172}
              height={724}
              priority
              className="mx-auto h-auto w-[200px] object-contain sm:w-[220px]"
            />
          </Link>

          <h1 className="mt-8 text-3xl font-bold">
            Create your SuperKuba account
          </h1>

          <p className="mt-3 text-white/50">
            Start building your AI workforce.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">

          <form onSubmit={handleSubmit} className="space-y-5">

            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3"
            />

            <input
              required
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3"
            />

            <input
              required
              minLength={8}
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3"
            />

            {error && (
              <div className="rounded-xl bg-red-500/20 p-3 text-red-300">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 py-3 font-bold"
            >
              {loading ? "Creating account..." : "Create SuperKuba account"}
            </button>

          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-300">
              Sign in
            </Link>
          </div>

        </div>

      </div>
    </main>
  );
}
