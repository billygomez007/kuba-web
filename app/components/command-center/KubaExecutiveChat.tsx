"use client";

import { useState } from "react";

type Message = {
  role: "user" | "kuba";
  content: string;
};


export default function KubaExecutiveChat() {

  const executivePrompts = [
    "Give me my CEO briefing for today.",
    "What needs my attention right now?",
    "How is my sales pipeline performing?",
    "Which customers or leads need follow-up?",
    "What are the biggest risks in my business?",
  ];

  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState<Message[]>([
      {
        role: "kuba",
        content:
          "Hello. I am Kuba, your business intelligence assistant. Ask me anything about your company.",
      },
    ]);


  const [loading, setLoading] =
    useState(false);


  async function sendMessage() {

    if (!input.trim()) return;


    const userMessage = input;


    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: userMessage,
      },
    ]);


    setInput("");
    setLoading(true);


    try {

      const response =
        await fetch(
          "/api/ai/command-center",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              message:
                userMessage,
            }),
          },
        );


      const data =
        await response.json();


      setMessages((current) => [
        ...current,
        {
          role: "kuba",
          content:
            data.response ||
            "I was unable to complete that request.",
        },
      ]);


    } catch {

      setMessages((current) => [
        ...current,
        {
          role: "kuba",
          content:
            "I could not connect right now.",
        },
      ]);

    } finally {

      setLoading(false);

    }

  }


  return (

    <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.04] to-violet-500/[0.08] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
        Kuba Executive Intelligence
      </p>


      <div className="flex items-center justify-between">

        <h2 className="mt-3 text-2xl font-black">
          Your AI CEO Advisor
        </h2>

        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
          Online
        </span>

      </div>

      <p className="mt-3 text-sm text-white/40">
        Ask Kuba about performance, opportunities, risks, customers, and what action you should take next.
      </p>


      <div className="mt-5 flex flex-wrap gap-2">
        {executivePrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>


      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">

        {messages.map((message, index) => (

          <div
            key={index}
            className={
              message.role === "user"
                ? "rounded-xl bg-cyan-400/10 p-3 text-sm"
                : "rounded-xl bg-black/20 p-3 text-sm text-white/80"
            }
          >
            {message.content}
          </div>

        ))}

      </div>


      <div className="mt-5 flex gap-3">

        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
          placeholder="How is my business performing?"
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
        />


        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {loading
            ? "Thinking..."
            : "Ask Kuba"}
        </button>

      </div>

    </section>

  );
}
