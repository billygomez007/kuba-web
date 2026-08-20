"use client";

import { useEffect, useState } from "react";

export default function WebsiteChatPage() {
  const [publicKey, setPublicKey] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/website-chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.integration?.publicKey) {
          setPublicKey(data.integration.publicKey);
        }
      });
  }, []);

  const code = publicKey
    ? `<script src="/kuba/chat.js" data-public-key="${publicKey}"></script>`
    : "Loading embed code...";

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <h1 className="text-3xl font-black">
          Website Chat Integration
        </h1>

        <p className="mt-3 text-white/50">
          Copy this code and paste it before the closing body tag of your website.
        </p>

        <div className="mt-8 rounded-2xl bg-black/40 p-5 overflow-auto">
          <code className="text-sm text-cyan-300">
            {code}
          </code>
        </div>

        <button
          onClick={copyCode}
          className="mt-5 rounded-xl bg-white px-6 py-3 font-bold text-black"
        >
          {copied ? "Copied" : "Copy Embed Code"}
        </button>

      </div>

    </main>
  );
}
