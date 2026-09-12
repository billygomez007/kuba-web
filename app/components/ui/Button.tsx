import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-black hover:bg-white/90 shadow-card",
  secondary:
    "border border-border-default bg-surface-subtle text-text-primary hover:border-border-strong hover:bg-surface-card-hover",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-subtle",
  danger:
    "bg-danger/15 text-danger border border-danger/25 hover:bg-danger/20",
  link:
    "text-accent hover:text-accent/80 underline-offset-4 hover:underline px-0 py-0",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2 text-xs",
  md: "min-h-11 px-5 py-3 text-sm",
  lg: "min-h-12 px-6 py-3.5 text-base",
};

const BASE = "inline-flex items-center justify-center gap-2 rounded-control font-bold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** Marketing surfaces intentionally use a pill shape; dashboard uses the
   * standard control radius. Documented, not arbitrary. */
  pill?: boolean;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: string; target?: string; rel?: string };

export default function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", className = "", children, pill = false, ...rest } = props;

  const classes = `${BASE} ${pill ? "rounded-pill" : ""} ${variant === "link" ? "" : SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`;

  if ("href" in props && props.href) {
    const { href, target, rel } = props as ButtonAsLink;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
