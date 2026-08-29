import type { ReactNode, HTMLAttributes } from "react";

export type CardVariant = "standard" | "interactive" | "subtle" | "elevated";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  standard: "border border-border-default bg-surface-card",
  interactive: "border border-border-default bg-surface-card transition hover:border-accent/25 hover:bg-surface-card-hover cursor-pointer",
  subtle: "border border-border-muted bg-transparent",
  elevated: "border border-border-default bg-surface-raised shadow-raised",
};

/**
 * Canonical card/surface primitive. The audit found every dashboard page
 * inventing its own card recipe (radius alternating 2xl/3xl, background
 * opacity 0.025/0.035/0.04, arbitrary border colors). Use this instead of
 * a bespoke `rounded-Nxl border border-white/N bg-white/[0.0N]` string.
 */
export default function Card({
  variant = "standard",
  padding = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const paddingClasses = { none: "", sm: "p-4", md: "p-6", lg: "p-8" }[padding];
  return (
    <div className={`rounded-card ${VARIANT_CLASSES[variant]} ${paddingClasses} ${className}`} {...rest}>
      {children}
    </div>
  );
}
