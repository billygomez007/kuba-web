import Link from "next/link";
import Button from "./Button";

export type ErrorVariant = "page" | "inline" | "permission" | "network";

const COPY: Record<ErrorVariant, { title: string }> = {
  page: { title: "Something went wrong" },
  inline: { title: "Unable to load this" },
  permission: { title: "You don't have access to this" },
  network: { title: "Connection problem" },
};

/**
 * Canonical error primitive. `message` should always be a human-readable
 * string already sanitized by the caller — never pass a raw thrown
 * error's internals through to this component.
 */
export default function ErrorState({
  variant = "inline",
  title: titleOverride,
  message,
  onRetry,
  dashboardHref = "/dashboard",
}: {
  variant?: ErrorVariant;
  /** Overrides the variant's default title when a more specific one is useful. */
  title?: string;
  message: string;
  onRetry?: () => void;
  dashboardHref?: string;
}) {
  const title = titleOverride ?? COPY[variant].title;

  if (variant === "page") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-6 text-text-primary">
        <div className="max-w-md text-center">
          <h1 className="text-h2">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-text-tertiary">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
            <Button variant="secondary" href={dashboardHref}>Dashboard</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div role="alert" className="rounded-card border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-danger/85">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-xs font-bold uppercase tracking-wide text-danger underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

export function InlineErrorLink({ message, href, label }: { message: string; href: string; label: string }) {
  return (
    <div role="alert" className="rounded-card border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
      <p>{message}</p>
      <Link href={href} className="mt-2 inline-block text-xs font-bold uppercase tracking-wide underline underline-offset-2">
        {label}
      </Link>
    </div>
  );
}
