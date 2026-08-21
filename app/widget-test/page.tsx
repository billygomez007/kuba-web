"use client";

import { useState } from "react";

export default function WidgetTestPage() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  async function sendMessage() {
    if (!message.trim()) return;

    const response = await fetch(
      "/api/widget/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      },
    );

    const data = await response.json();

    setReply(data.response || "No response");
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-[#050507] p-10 text-white">

      <h1 className="text-4xl font-black">
        Kuba Widget Test
      </h1>

      <p className="mt-4 text-white/50">
        Testing Kuba AI website chat.
      </p>

      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-8 right-8 h-16 w-16 rounded-full bg-cyan-400 text-2xl text-black"
      >
        💬
      </button>


      {open && (
        <div className="fixed bottom-28 right-8 w-[350px] rounded-3xl border border-white/10 bg-[#111116] p-6">

          <h2 className="text-xl font-bold">
            Kuba AI
          </h2>


          {reply && (
            <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm">
              {reply}
            </p>
          )}


          <div className="mt-5 flex gap-2">

            <input
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder="Ask Kuba..."
              className="flex-1 rounded-xl bg-black/30 px-3 py-2"
            />


            <button
              onClick={sendMessage}
              className="rounded-xl bg-white px-4 text-black"
            >
              Send
            </button>

          </div>

        </div>
      )}

    </main>
  );
}
