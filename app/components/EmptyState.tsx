"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
  compact?: boolean;
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  className = "",
  compact = false,
}: EmptyStateProps) {
  const actionClasses =
    "inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] hover:shadow-blue-500/30";

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-white/[0.025] text-center ${compact ? "p-6" : "px-6 py-10 sm:px-10 sm:py-12"} ${className}`}>
      <div className="pointer-events-none absolute inset-x-1/4 top-0 h-24 bg-cyan-400/10 blur-3xl" />
      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/10 to-violet-500/10 text-2xl text-cyan-200 shadow-lg shadow-cyan-500/10">
          {icon}
        </div>
        <h3 className={`${compact ? "mt-4 text-base" : "mt-5 text-lg"} font-bold text-white`}>{title}</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/40">{description}</p>
        {(actionLabel || secondaryLabel) && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {actionLabel && actionHref && <Link href={actionHref} className={actionClasses}>{actionLabel}</Link>}
            {actionLabel && onAction && <button type="button" onClick={onAction} className={actionClasses}>{actionLabel}</button>}
            {secondaryLabel && secondaryHref && <Link href={secondaryHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/65 transition hover:border-white/20 hover:text-white">{secondaryLabel}</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
