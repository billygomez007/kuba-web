import Link from "next/link";

export default function SuperKubaErrorPage({
  title,
  description,
  primaryHref,
  onRetry,
}: {
  title: string;
  description: string;
  primaryHref: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/45">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black"
          >
            Try again
          </button>
          <Link
            href={primaryHref}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
