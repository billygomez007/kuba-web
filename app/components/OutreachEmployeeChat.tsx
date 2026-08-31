"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  mode?: "chat" | "autonomous_research";
};

type Props = {
  employeeId: string;
};

export default function OutreachEmployeeChat({
  employeeId,
}: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const busy = loading || researching;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi. I'm Kuba Outreach. I can research prospects, identify buying signals, qualify opportunities, and prepare personalized outreach for your approval.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    async function loadConversation() {
      try {
        const response = await fetch(
          `/api/ai/conversations?employeeId=${encodeURIComponent(employeeId)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.messages?.length) {
          setMessages(
            data.messages.map(
              (item: {
                direction: "inbound" | "outbound";
                content: string;
              }) => ({
                role:
                  item.direction === "inbound"
                    ? "user"
                    : "assistant",
                content: item.content,
              }),
            ),
          );
        }
      } catch (error) {
        console.error(
          "Outreach conversation loading error:",
          error,
        );
      } finally {
        setLoadingHistory(false);
      }
    }

    loadConversation();
  }, [employeeId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || busy) {
      return;
    }

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedMessage,
        mode: "chat",
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/ai/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          employeeId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Kuba Outreach could not respond.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
          mode: "chat",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
          mode: "chat",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * Explicit, separate action for a full research-and-persist operation.
   * This is the ONLY UI path that sends mode: "autonomous_research", which
   * routes the request through the deterministic outreach research
   * pipeline (independent database verification of every save) instead of
   * ordinary conversational tool-calling. The user must deliberately choose
   * this button — it is never inferred from the wording of a chat message.
   */
  async function handleRunResearch() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || busy) {
      return;
    }

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedMessage,
        mode: "autonomous_research",
      },
    ]);

    setResearching(true);

    try {
      const response = await fetch("/api/ai/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          employeeId,
          mode: "autonomous_research",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Kuba Outreach could not complete this research operation.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
          mode: "autonomous_research",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
          mode: "autonomous_research",
        },
      ]);
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="flex h-[620px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-lg text-cyan-300">
            ⌁
          </div>

          <div>
            <h2 className="font-bold text-white">
              Chat with Kuba Outreach
            </h2>

            <p className="text-xs text-white/30">
              AI prospecting & business development operator
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {loadingHistory && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/30">
            Loading Kuba Outreach memory...
          </div>
        )}

        {messages.map((item, index) => (
          <div
            key={index}
            className={`flex ${
              item.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div className="max-w-2xl">
              {item.mode === "autonomous_research" && (
                <div
                  className={`mb-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300/70 ${
                    item.role === "user"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  Prospect Research
                </div>
              )}

              <div
                className={`whitespace-pre-wrap rounded-2xl px-5 py-4 text-sm leading-6 ${
                  item.role === "user"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/70"
                }`}
              >
                {item.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/35">
              Kuba Outreach is responding...
            </div>
          </div>
        )}

        {researching && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] px-5 py-4 text-sm text-cyan-200/70">
              Running full prospect research — researching, verifying evidence, and persisting only what is confirmed. This can take a minute.
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/10 p-5">
        <p className="mb-2 text-[11px] text-white/25">
          <span className="font-semibold text-white/40">Send</span> is
          ordinary conversation.{" "}
          <span className="font-semibold text-white/40">
            Run Prospect Research
          </span>{" "}
          launches an autonomous operation that searches the web, persists a
          prospect, evidence, and contact route, and qualifies it — always
          independently verified, never sent externally.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex gap-3"
        >
          <input
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Ask Kuba Outreach to research or qualify prospects..."
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-400/40"
          />

          <button
            type="button"
            onClick={handleRunResearch}
            disabled={busy || !message.trim()}
            title="Run a full autonomous research operation: search, verify, persist, and qualify — independently verified, nothing sent externally."
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {researching ? "Researching..." : "Run Prospect Research"}
          </button>

          <button
            type="submit"
            disabled={busy || !message.trim()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Working..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
