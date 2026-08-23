export default function ExecutiveIntelligencePanels() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {[
        ["Business signal", "Your AI workforce is monitoring daily operations."],
        ["Revenue focus", "Keep conversations and follow-ups moving."],
        ["Customer context", "Shared intelligence keeps every interaction connected."],
      ].map(([label, description]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/60">{label}</p>
          <p className="mt-3 text-sm leading-6 text-white/45">{description}</p>
        </div>
      ))}
    </section>
  );
}
