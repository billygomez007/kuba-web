"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  name: string;
  type: string;
  description: string;
  templateId?: string;
};

export default function ActivateEmployeeButton({
  name,
  type,
  description,
  templateId,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activateEmployee() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai-employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          description,
          templateId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to activate AI employee.",
        );
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to activate AI employee.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={activateEmployee}
        disabled={loading}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Activating..." : "Activate"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}