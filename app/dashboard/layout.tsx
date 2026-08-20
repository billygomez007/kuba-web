"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  {
    label: "Command Center",
    href: "/dashboard",
    icon: "⌂",
  },
  {
    label: "AI Workforce",
    href: "/dashboard/workforce",
    icon: "✦",
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: "◎",
  },
  {
    label: "Messaging",
    href: "/dashboard/messaging",
    icon: "◌",
  },
  {
    label: "Knowledge",
    href: "/dashboard/knowledge",
    icon: "🧠",
  },
  {
    label: "Automations",
    href: "/dashboard/automations",
    icon: "⌁",
  },
  {
    label: "Tasks",
    href: "/dashboard/tasks",
    icon: "✓",
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: "▥",
  },
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: "⌘",
    permission: "integrations.view",
  },
];

const navigationPermissions: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/dashboard/workforce": "workforce.view",
  "/dashboard/customers": "customers.view",
  "/dashboard/messaging": "messaging.view",
  "/dashboard/knowledge": "knowledge.view",
  "/dashboard/automations": "automations.view",
  "/dashboard/tasks": "tasks.view",
  "/dashboard/analytics": "analytics.view",
  "/dashboard/integrations": "integrations.view",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setPermissions([]);
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          const userPermissions = Array.isArray(
            data.membership?.permissions,
          )
            ? data.membership.permissions
            : [];

          setPermissions(userPermissions);

          const matchedRoute = Object.keys(
            navigationPermissions,
          )
            .sort((a, b) => b.length - a.length)
            .find(
              (route) =>
                pathname === route ||
                pathname.startsWith(`${route}/`),
            );

          if (
            matchedRoute &&
            !userPermissions.includes(
              navigationPermissions[matchedRoute],
            )
          ) {
            router.replace("/dashboard");
          }
        }
      } catch {
        if (!cancelled) setPermissions([]);
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleNavigation =
    permissions === null
      ? navigation
      : navigation.filter((item) => {
          const required =
            navigationPermissions[item.href];

          if (!required) return true;

          return permissions.includes(required);
        });

  return (
    <div className="min-h-screen bg-[#050507] text-white">

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[250px] border-r border-white/[0.07] bg-[#07070A]/95 lg:flex lg:flex-col">

        {/* Logo */}
        <div className="flex h-20 items-center border-b border-white/[0.07] px-6">
          <Link href="/dashboard" className="flex items-center">
            <img
              src="/brand/kuba-logo-3d.png"
              alt="Kuba AI"
              className="h-auto w-[145px]"
            />
          </Link>
        </div>

        {/* Workspace */}
        <div className="px-4 py-5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/20">
            Workspace
          </p>

          <nav className="mt-3 space-y-1">
            {visibleNavigation.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                      active
                        ? "bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300"
                        : "bg-white/[0.03] text-white/30 group-hover:text-white/60"
                    }`}
                  >
                    {item.icon}
                  </span>

                  <span>{item.label}</span>

                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom */}
        <div className="mt-auto border-t border-white/[0.07] p-4">

          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-sm text-white/40">
              ⚙
            </span>

            <span>Settings</span>
          </Link>

          <Link
            href="/dashboard/settings/team"
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/dashboard/settings/team")
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-white/40">
              👥
            </span>

            <span>Team & Staff</span>
          </Link>

          <div className="mt-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              <span className="text-xs font-semibold text-emerald-300">
                Kuba is active
              </span>
            </div>

            <p className="mt-2 text-[10px] leading-4 text-white/25">
              Your AI workforce is ready to work.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#050507]/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard">
            <img
              src="/brand/kuba-logo-3d.png"
              alt="Kuba AI"
              className="h-auto w-[125px]"
            />
          </Link>

          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/50"
          >
            ⚙
          </Link>
        </div>

        {/* Mobile navigation */}
        <div className="overflow-x-auto border-t border-white/[0.05] px-4 py-2">
          <nav className="flex min-w-max gap-1">
            {navigation.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-white/35 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="lg:pl-[250px]">
        {children}
      </div>
    </div>
  );
}
