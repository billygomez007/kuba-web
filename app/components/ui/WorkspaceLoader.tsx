export default function WorkspaceLoader({
  label = "Loading workspace",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[55vh] w-full items-center justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center"
      >
        <div className="relative h-11 w-11">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-[5px] animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300/40" />
          <div className="absolute inset-[15px] rounded-full bg-cyan-300/80 shadow-[0_0_18px_rgba(103,232,249,0.35)]" />
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
          {label}
        </p>
      </div>
    </div>
  );
}
