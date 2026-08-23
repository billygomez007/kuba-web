export default function BusinessGreeting({
  name,
  logoUrl,
  industry,
  activeEmployeeCount,
  businessTimezone,
  userTimezone,
}: {
  name: string;
  logoUrl?: string | null;
  industry?: string;
  activeEmployeeCount: number;
  businessTimezone: string | null;
  userTimezone: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-xl font-black text-cyan-300">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
          {industry}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {name}
        </h1>
        <p className="mt-2 text-sm text-white/40">
          {activeEmployeeCount} active AI employee{activeEmployeeCount === 1 ? "" : "s"}
          {businessTimezone && userTimezone && businessTimezone !== userTimezone ? "" : ""}
        </p>
      </div>
    </div>
  );
}
