"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  ownerOnly?: boolean;
  permission?: string;
};

type NavigationGroup = {
  title?: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [

  {
    title: "Super Admin",

    items: [
      {
        label: "Admin Command Center",
        href: "/admin",
        icon: "⌂",
      },
      {
        label: "Businesses",
        href: "/admin/businesses",
        icon: "▣",
      },
    ],
  },


  {
    title: "Business Operations",
    items: [
      {
        label: "Command Center",
        href: "/dashboard",
        icon: "⌂",
      },
      {
        label: "AI Workforce",
        href: "/dashboard/workforce",
        icon: "✦",
        permission: "workforce.view",
      },
      {
        label: "Workforce Command Center",
        href: "/dashboard/workforce-command-center",
        icon: "◉",
        permission: "workforce.view",
      },
      {
        label: "AI Workforce Control Center",
        href: "/dashboard/workforce/control-center",
        icon: "▣",
        permission: "workforce.view",
      },
      {
        label: "Workforce Team",
        href: "/dashboard/workforce/team",
        icon: "♙",
        permission: "workforce.view",
      },
      {
        label: "Orchestration",
        href: "/dashboard/workforce/orchestration",
        icon: "⇄",
        permission: "workforce.view",
      },
      {
        label: "Simulator",
        href: "/dashboard/workforce/simulator",
        icon: "◌",
        permission: "workforce.view",
      },
      {
        label: "Certification",
        href: "/dashboard/workforce/certification",
        icon: "✓",
        permission: "workforce.view",
      },
      {
        label: "Monitoring",
        href: "/dashboard/workforce/monitoring",
        icon: "◉",
        permission: "workforce.view",
      },
      {
        label: "Automation",
        href: "/dashboard/automations",
        icon: "⚙",
      },
      {
        label: "Billing & Usage",
        href: "/dashboard/billing",
        icon: "$",
        permission: "workforce.view",
      },
      {
        label: "Approvals",
        href: "/dashboard/approvals",
        icon: "✓",
        permission: "messaging.manage",
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
    ],
  },
  {
    title: "Customer Operations",
    items: [
      {
        label: "Inbox",
        href: "/dashboard/inbox",
        icon: "✉",
        permission: "messaging.view",
      },
      {
        label: "Customers",
        href: "/dashboard/customers",
        icon: "◎",
        permission: "customers.view",
      },
      {
        label: "Follow-ups",
        href: "/dashboard/follow-ups",
        icon: "◌",
        permission: "followups.view",
      },
    ],
  },
  {
    title: "AI Workforce",
    items: [
      {
        label: "Employees",
        href: "/dashboard/ai-employees",
        icon: "✦",
        permission: "workforce.view",
      },
      {
        label: "Approvals",
        href: "/dashboard/approvals",
        icon: "✓",
        permission: "messaging.manage",
      },
      {
        label: "Tasks",
        href: "/dashboard/tasks",
        icon: "✓",
        permission: "tasks.view",
      },
      {
        label: "Knowledge",
        href: "/dashboard/knowledge",
        icon: "▤",
        permission: "knowledge.view",
      },
      {
        label: "Business Brain",
        href: "/dashboard/business-brain",
        icon: "◈",
        permission: "knowledge.view",
      },
      {
        label: "Memory & Learning",
        href: "/dashboard/business-brain/memory",
        icon: "◉",
        permission: "knowledge.view",
      },
      {
        label: "Workforce Marketplace",
        href: "/dashboard/workforce-marketplace",
        icon: "✺",
        permission: "workforce.view",
      },
      {
        label: "Marketplace",
        href: "/dashboard/marketplace",
        icon: "◫",
        permission: "workforce.view",
      },
      {
        label: "Ecosystem Marketplace",
        href: "/dashboard/ecosystem",
        icon: "◇",
        permission: "workforce.view",
      },
    ],
  },
];

const navigationPermissions: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/dashboard/ai-employees": "workforce.view",
  "/dashboard/approvals": "messaging.manage",
  "/dashboard/workforce": "workforce.view",
  "/dashboard/workforce/control-center": "workforce.view",
  "/dashboard/workforce/orchestration": "workforce.view",
  "/dashboard/workforce/simulator": "workforce.view",
  "/dashboard/workforce/certification": "workforce.view",
  "/dashboard/workforce/monitoring": "workforce.view",
  "/dashboard/workforce/operations": "workforce.view",
  "/dashboard/marketplace": "workforce.view",
  "/dashboard/marketplace/install": "workforce.view",
  "/dashboard/marketplace/installations": "workforce.view",
  "/dashboard/ecosystem": "workforce.view",
  "/dashboard/inbox": "messaging.view",
  "/dashboard/customers": "customers.view",
  "/dashboard/follow-ups": "followups.view",
  "/dashboard/tasks": "tasks.view",
  "/dashboard/knowledge": "knowledge.view",
  "/dashboard/business-brain": "knowledge.view",
  "/dashboard/automations": "automations.view",
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

  const [permissions, setPermissions] =
    useState<string[] | null>(null);

  const [role, setRole] =
    useState<string | null>(null);

  const [platformRole, setPlatformRole] =
    useState<string | null>(null);

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

          setRole(
            data.membership?.role || null,
          );

          setPlatformRole(
            data.user?.platformRole || null,
          );

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

  const visibleNavigation = navigationGroups.flatMap((group) =>
    group.items.filter((item) => {

      if (
        group.title === "Super Admin" &&
        platformRole !== "super_admin"
      ) {
        return false;
      }


      if (
        group.title !== "Super Admin" &&
        platformRole === "super_admin"
      ) {
        return true;
      }


      if (
        item.ownerOnly &&
        role !== "owner"
      ) {
        return false;
      }


      const required =
        navigationPermissions[item.href];

      if (!required) return true;

      return permissions === null ||
        permissions.includes(required);

    })
  );

  return (
    <div className="min-h-screen bg-[#050507] text-white">

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[260px] border-r border-white/[0.07] bg-[#07070A]/95 backdrop-blur-sm lg:flex lg:flex-col">

        {/* Logo & Branding */}
        <div className="flex h-20 items-center border-b border-white/[0.07] px-6">
          <Link href="/" className="flex items-center" aria-label="SuperKuba homepage">
            <Image
              src="/brand/superkuba-logo.png"
              alt="SuperKuba"
              width={2103}
              height={748}
              priority
              className="h-auto w-[140px] object-contain"
            />
          </Link>
        </div>

        {/* Navigation Workspace */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {navigationGroups.map((group) => {

            if (
              group.title === "Super Admin" &&
              platformRole !== "super_admin"
            ) {
              return null;
            }

            const items = group.items.filter((item) => {

              if (
                item.ownerOnly &&
                role !== "owner"
              ) {
                return false;
              }

              const required =
                navigationPermissions[item.href];

              if (!required) return true;

              return permissions === null ||
                permissions.includes(required);

            });


            if (items.length === 0) return null;


            return (

              <div key={group.title || "main"} className="mb-6">

                {group.title && (
                  <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/20">
                    {group.title}
                  </p>
                )}


                <div className="space-y-1.5">

                  {items.map((item) => {

                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);


                    return (

                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-white/[0.08] text-white shadow-lg shadow-white/5"
                            : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                        }`}
                      >

                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-md text-base font-semibold transition ${
                            active
                              ? "bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 shadow-lg shadow-cyan-400/10"
                              : "bg-white/[0.04] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/60"
                          }`}
                        >
                          {item.icon}
                        </span>


                        <span className="flex-1 truncate">{item.label}</span>


                        {active && (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                          </>
                        )}

                      </Link>

                    );

                  })}

                </div>

              </div>

            );

          })}
        </nav>

        {/* Bottom Sidebar Section */}
        <div className="border-t border-white/[0.07] p-4">

          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-white/[0.08] text-white"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-base text-white/40">
              ⚙
            </span>

            <span>Settings</span>
          </Link>

          <Link
            href="/dashboard/settings/team"
            className={`mt-1.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/dashboard/settings/team")
                ? "bg-white/[0.08] text-white"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-base text-white/40">
              👥
            </span>

            <span>Team</span>
          </Link>

          <Link
            href="/help"
            className="mt-1.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white/70"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-base text-white/40">
              ?
            </span>

            <span>Help</span>
          </Link>

          {/* AI Workforce Status */}
          <div className="mt-4 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              <span className="text-xs font-semibold text-emerald-300">
                SuperKuba Active
              </span>
            </div>

            <p className="mt-2 text-[11px] leading-4 text-white/35">
              AI workforce ready
            </p>
          </div>
        </div>
      </aside>
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#050507]/90 backdrop-blur-lg lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" aria-label="SuperKuba homepage">
            <Image
              src="/brand/superkuba-logo.png"
              alt="SuperKuba"
              width={2103}
              height={748}
              priority
              className="h-auto w-[125px] object-contain"
            />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/help"
              aria-label="Help and Support"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-sm font-semibold text-white/50 transition hover:bg-white/[0.08]"
            >
              ?
            </Link>
            <Link
              href="/dashboard/settings"
              aria-label="Dashboard settings"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-sm text-white/50 transition hover:bg-white/[0.08]"
            >
              ⚙
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="overflow-x-auto border-t border-white/[0.05]">
          <nav className="flex min-w-max gap-1 px-4 py-2">
            {visibleNavigation.slice(0, 6).map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="lg:pl-[260px]">
        {children}
      </div>
    </div>
  );
}

