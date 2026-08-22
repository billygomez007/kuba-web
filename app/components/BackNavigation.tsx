"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type BackNavigationProps = {
  className?: string;
  fallbackHref?: string;
  label?: string;
};

export default function BackNavigation({
  className = "",
  fallbackHref = "/",
  label = "Back",
}: BackNavigationProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
