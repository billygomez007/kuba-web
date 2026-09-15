"use client";

import { useMemo, useState } from "react";

export type CustomToolCatalogItem = {
  toolId: string;
  label: string;
  category: string;
  riskLevel: "low" | "medium";
  description: string;
  granted: boolean;
};

type Props = {
  employeeId: string;
  canManage: boolean;
  initialCatalog: CustomToolCatalogItem[];
};

/**
 * The only user-facing surface for a Custom employee's curated tool grants.
 * The catalog itself (which tools exist, their risk level) is entirely
 * server-controlled — this component can only select a subset of what the
 * server already sent it, never invent a new tool ID.
 */
export default function CustomToolPermissions({ employeeId, canManage, initialCatalog }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialCatalog.filter((item) => item.granted).map((item) => item.toolId)),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, CustomToolCatalogItem[]>();
    for (const item of initialCatalog) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [initialCatalog]);

  function toggle(toolId: string) {
    if (!canManage) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/ai-employees/${employeeId}/tools`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolIds: [...selected] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save tool permissions.");
      setStatus({ kind: "success", message: "Tool permissions saved." });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Unable to save tool permissions." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
      <h2 className="text-xl font-black">Allowed tools</h2>
      <p className="mt-2 text-sm text-white/40">
        Choose which real business tools this Custom employee can use. This is the platform&apos;s full curated,
        safe catalog — nothing outside this list can ever be granted. Every granted tool still respects this
        employee&apos;s own approval settings.
      </p>

      <div className="mt-6 space-y-6">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">{category}</h3>
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <label
                  key={item.toolId}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.toolId)}
                    onChange={() => toggle(item.toolId)}
                    disabled={!canManage}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {item.label}
                      {item.riskLevel === "medium" && (
                        <span className="ml-2 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          Sensitive
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-white/40">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-6 flex items-center gap-4 border-t border-white/[0.08] pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Tool Permissions"}
          </button>
          {status && (
            <span className={status.kind === "success" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
              {status.message}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
