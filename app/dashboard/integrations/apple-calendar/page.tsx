"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

type Status = {
  connected: boolean;
  account?: string | null;
  calendarHomeReady?: boolean;
};

export default function AppleCalendarPage() {
  const [
    status,
    setStatus,
  ] = useState<Status>({
    connected: false,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  async function load() {
    try {
      const response =
        await fetch(
          "/api/integrations/apple-calendar/status",
          {
            cache:
              "no-store",
          },
        );

      const body =
        await response.json();

      if (response.ok) {
        setStatus(body);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const form =
      new FormData(
        event.currentTarget,
      );

    try {
      const response =
        await fetch(
          "/api/integrations/apple-calendar/connect",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                serverUrl:
                  form.get(
                    "serverUrl",
                  ),
                username:
                  form.get(
                    "username",
                  ),
                password:
                  form.get(
                    "password",
                  ),
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Unable to connect Apple Calendar.",
        );
      }

      setMessage(
        "Apple Calendar connected successfully.",
      );

      event.currentTarget.reset();

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect Apple Calendar.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/integrations/apple-calendar/disconnect",
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Unable to disconnect Apple Calendar.",
        );
      }

      setMessage(
        "Apple Calendar disconnected.",
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to disconnect Apple Calendar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/integrations/calendar"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← Calendar integrations
        </Link>

        <h1 className="mt-5 text-3xl font-black">
          Apple Calendar
        </h1>

        <p className="mt-3 text-white/50">
          Connect iCloud Calendar through
          CalDAV. Use your Apple ID and an
          Apple app-specific password.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {!loading &&
        status.connected ? (
          <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Connected
            </p>

            <h2 className="mt-3 text-xl font-bold">
              Apple Calendar
            </h2>

            <p className="mt-2 text-sm text-white/50">
              Account:{" "}
              {status.account ||
                "Configured"}
            </p>

            <p className="mt-2 text-sm text-white/50">
              Calendar home:{" "}
              {status.calendarHomeReady
                ? "Discovered"
                : "Connection verified"}
            </p>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void disconnect()
              }
              className="mt-6 rounded-xl border border-red-300/20 px-5 py-3 text-sm font-bold text-red-200 disabled:opacity-50"
            >
              Disconnect
            </button>
          </section>
        ) : (
          <form
            onSubmit={connect}
            className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <label className="block">
              <span className="text-sm font-semibold">
                CalDAV server
              </span>

              <input
                name="serverUrl"
                type="url"
                required
                defaultValue="https://caldav.icloud.com/"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">
                Apple ID
              </span>

              <input
                name="username"
                type="email"
                required
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">
                App-specific password
              </span>

              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <p className="text-xs leading-5 text-white/35">
              Your credentials are encrypted
              before storage and are never
              returned by the integration
              status API.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {saving
                ? "Verifying…"
                : "Connect Apple Calendar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
