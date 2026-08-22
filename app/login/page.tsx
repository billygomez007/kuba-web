"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "../../lib/auth-client";
import BackNavigation from "../components/BackNavigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const invitationToken =
    searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Unable to sign in. Please check your details.");
      return;
    }

    if (invitationToken) {
      router.push(
        `/invite?token=${encodeURIComponent(invitationToken)}`
      );
    } else {
      router.push("/dashboard");
    }

    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      {/* Ambient Kuba background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
        <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[150px]" />
        <div className="absolute bottom-[-250px] left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/5 blur-[150px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <BackNavigation className="mb-8" label="Back to SuperKuba" />

          {/* Kuba Logo */}
          <div className="mb-10 flex justify-center">
            <Link href="/" className="group">
              <Image
                src="/brand/superkuba-logo.png"
                alt="SuperKuba"
                width={2131}
                height={738}
                priority
                className="h-auto w-[210px] object-contain transition duration-300 group-hover:scale-[1.02] sm:w-[230px]"
              />
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/45">
              Sign in to your SuperKuba AI workspace.
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-cyan-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="you@company.com"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-cyan-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="Enter your password"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Sign In */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.01] hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in to SuperKuba"}
              </button>
            </form>

            {/* Signup */}
            <div className="mt-7 border-t border-white/[0.07] pt-6 text-center text-sm text-white/40">
              Don&apos;t have a SuperKuba account?{" "}
              <Link
                href={
                  invitationToken
                    ? `/invite?token=${encodeURIComponent(invitationToken)}`
                    : "/signup"
                }
                className="font-semibold text-cyan-300 transition hover:text-white"
              >
                {invitationToken
                  ? "Create an account"
                  : "Create an account"}
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/20">
              AI Workforce for the Future
            </p>

            <p className="mt-3 text-xs text-white/20">
              © {new Date().getFullYear()} SuperKuba AI. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </main>
  );}

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
      <p className="text-white/60">
        Loading SuperKuba...
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
