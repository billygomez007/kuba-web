export default function SuperKubaLoading({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full border border-cyan-300/40 bg-cyan-300/10" />
        <p className="mt-5 text-sm text-white/50">{message}</p>
      </div>
    </main>
  );
}
