"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

  useEffect(() => {
    if (!token) {
      setError(
        "This invitation link is missing its invitation token.",
      );
    }
  }, [token]);

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
          <Link href="/" aria-label="SuperKuba homepage">
            <Image
              src="/brand/superkuba-logo.png"
              alt="SuperKuba"
              width={2131}
              height={738}
              priority
              className="mx-auto h-auto w-[180px] object-contain sm:w-[200px]"
            />
          </Link>

          <h1 className="mt-8 text-3xl font-bold">
            Join your team
          </h1>

          <p className="mt-3 text-white/50">
            Create your SuperKuba account and join the
            business you were invited to.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
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
            Already have a SuperKuba account?{" "}
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
