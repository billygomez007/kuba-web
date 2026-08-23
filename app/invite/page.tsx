"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const missingTokenError = !token
    ? "This invitation link is missing its invitation token."
    : "";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!token) {
      setError("Invalid invitation link.");
      return;
    }

    if (
      !name.trim() ||
      !email.trim() ||
      password.length < 8
    ) {
      setError(
        "Please enter your full name, email address and a password of at least 8 characters.",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result =
        await authClient.signUp.email({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });

      if (result.error) {
        setError(
          result.error.message ||
            "Unable to create your account.",
        );
        return;
      }

      const response = await fetch(
        "/api/team/invitations/accept",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Your account was created, but we could not connect it to the business invitation.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete the invitation.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 py-12 text-white">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <img
            src="/brand/kuba-logo-3d.png"
            alt="Kuba AI"
            className="mx-auto w-[190px]"
          />

          <h1 className="mt-8 text-3xl font-bold">
            Join your team
          </h1>

          <p className="mt-3 text-white/50">
            Create your Kuba account and join the
            business you were invited to.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">

          {(error || missingTokenError) && (
            <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error || missingTokenError}
            </div>
          )}

          {!token ? (
            <div className="text-center">
              <p className="text-white/70">
                This invitation link is invalid or
                incomplete.
              </p>

              <Link
                href="/login"
                className="mt-5 inline-block text-cyan-300"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Full name
                </label>

                <input
                  required
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="John Mensah"
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Email address
                </label>

                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="john@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Password
                </label>

                <input
                  required
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 py-3 font-bold text-black disabled:opacity-50"
              >
                {loading
                  ? "Joining your team..."
                  : "Join Team"}
              </button>

            </form>
          )}

          <div className="mt-6 text-center text-sm text-white/40">
            Already have a Kuba account?{" "}
            <Link
              href="/login"
              className="text-cyan-300"
            >
              Sign in
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}

function InviteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
      <p className="text-white/60">
        Loading invitation...
      </p>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteLoading />}>
      <InviteForm />
    </Suspense>
  );
}
