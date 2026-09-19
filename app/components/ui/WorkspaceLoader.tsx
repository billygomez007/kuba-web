export default function WorkspaceLoader({
  label = "Opening workspace",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[52vh] w-full items-center justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center"
      >
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-[0_12px_36px_rgba(0,0,0,0.25)]" />
          <div className="absolute h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-cyan-300" />
          <div className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)]" />
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
          {label}
        </p>
      </div>
    </div>
  );
}
