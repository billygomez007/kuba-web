/**
 * Canonical loading primitive. Replaces the ad hoc plain-text "Loading
 * X..." each page previously wrote inline, and consolidates the
 * previous full-page-only SuperKubaLoading component so the same visual
 * language now also covers panel/table density without a second,
 * differently-styled component.
 */
export default function LoadingState({
  message = "Loading...",
  variant = "panel",
}: {
  message?: string;
  variant?: "page" | "panel" | "inline";
}) {
  if (variant === "page") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page text-text-primary">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full border border-accent/40 bg-accent/10 motion-reduce:animate-none" />
          <p className="mt-5 text-sm text-text-tertiary">{message}</p>
        </div>
      </main>
    );
  }

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-text-tertiary">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent/60 motion-reduce:animate-none" aria-hidden="true" />
        {message}
      </span>
    );
  }

  return (
    <div className="p-12 text-center text-sm text-text-muted" role="status">
      {message}
    </div>
  );
}
