"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  employeeId: string;
};

export default function SalesEmployeeChat({
  employeeId,
}: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi. I'm Kuba Sales. Tell me what you'd like me to work on.",
    },
  ]);

  const [loadingHistory, setLoadingHistory] = useState(true);

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
            data.messages.map((item: any) => ({
              role:
                item.direction === "inbound"
                  ? "user"
                  : "assistant",
              content: item.content,
            })),
          );
        }
      } catch (error) {
        console.error(
          "Conversation loading error:",
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

    if (!trimmedMessage || loading) {
      return;
    }

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedMessage,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/ai/sales", {
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
          data.error || "Kuba Sales could not respond.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
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
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-lg">
            ↗
          </div>

          <div>
            <h2 className="font-bold text-white">
              Chat with Kuba Sales
            </h2>

            <p className="text-xs text-white/30">
              Your AI sales employee
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-6">

        {loadingHistory && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/30">
            Loading Kuba Sales memory...
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
            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 text-sm leading-6 ${
                item.role === "user"
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/[0.04] text-white/70"
              }`}
            >
              {item.content}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/35">
              Kuba Sales is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-5 bg-black/10">
        <form
          onSubmit={handleSubmit}
          className="flex gap-3"
        >
          <input
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Ask Kuba Sales to help with something..."
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
          />

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Working..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}