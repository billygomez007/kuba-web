"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { capabilityMinimumPlan, planDefinitions } from "@/lib/billing/plan-definitions";
import LogoutControl from "../components/settings/LogoutControl";

type NavigationItem = {
  label: string;
  href?: string;
  icon: string;
  ownerOnly?: boolean;
  permission?: string;
  status?: "Coming Soon" | "Planned";
  children?: string[];
};

type NavigationGroup = {
  title: string;
  icon: string;
  items: NavigationItem[];
};

type AccessibleBusiness = {
  id: string;
  name: string;
  role: string;
  branchId: string | null;
};

type BusinessEntitlements = {
  plan: string;
  planName: string;
  capabilities: string[];
  limits: Record<string, number | null>;
};

const navigationGroups: NavigationGroup[] = [
  {
    title: "Command Center",
    icon: "⌂",
    items: [
      { label: "Organization Overview", icon: "◇", status: "Coming Soon" },
      { label: "Business Overview", href: "/dashboard", icon: "⌂" },
      { label: "Branch Overview", icon: "⌖", status: "Coming Soon" },
    ],
  },
  {
    title: "AI Workforce",
    icon: "✦",
    items: [
      { label: "AI Employees", href: "/dashboard/ai-employees", icon: "✦", permission: "workforce.view" },
      { label: "AI Employee Builder", href: "/dashboard/ai-employees/create", icon: "+", permission: "workforce.view" },
      { label: "AI Teams", href: "/dashboard/workforce/team", icon: "♙", permission: "workforce.view" },
      { label: "Collections Agent", icon: "◫", status: "Coming Soon" },
      { label: "Deployment", href: "/dashboard/workforce/deployment", icon: "⇧", permission: "workforce.view" },
      { label: "Orchestration", href: "/dashboard/workforce/orchestration", icon: "⇄", permission: "workforce.view" },
      { label: "Monitoring", href: "/dashboard/workforce/monitoring", icon: "◉", permission: "workforce.view" },
      { label: "Performance", href: "/dashboard/ai-performance", icon: "▥", permission: "workforce.view" },
      { label: "Voice", href: "/dashboard/settings/voice-providers", icon: "◖", permission: "workforce.view" },
      { label: "Skills", icon: "✣", status: "Planned" },
      { label: "Simulator", href: "/dashboard/workforce/simulator", icon: "◌", permission: "workforce.view" },
      { label: "Marketplace", href: "/dashboard/workforce-marketplace", icon: "◫", permission: "workforce.view" },
    ],
  },
  {
    title: "Human Workforce",
    icon: "♙",
    items: [
      { label: "Workforce Overview", href: "/dashboard/human-workforce", icon: "⌂", permission: "workforce.view" },
      { label: "Employees", href: "/dashboard/human-workforce/employees", icon: "◎", permission: "workforce.view" },
      { label: "HR", href: "/dashboard/human-workforce/hr", icon: "▤", permission: "workforce.view", children: ["Employee Records", "Departments", "Positions", "Contracts", "Documents", "Attendance", "Leave", "Performance", "Recruitment"] },
      { label: "Payroll", href: "/dashboard/human-workforce/payroll", icon: "$", permission: "workforce.view" },
      { label: "Operational Teams", href: "/dashboard/human-workforce/teams", icon: "♙", permission: "workforce.view" },
    ],
  },
  {
    title: "Customer Operations",
    icon: "✉",
    items: [
      { label: "Inbox", href: "/dashboard/inbox", icon: "✉", permission: "messaging.view" },
      { label: "Customers", href: "/dashboard/customers", icon: "◎", permission: "customers.view" },
      { label: "Leads", href: "/dashboard/sales", icon: "↗", permission: "sales.view" },
      { label: "Conversations", href: "/dashboard/conversations", icon: "◌", permission: "messaging.view" },
      { label: "Follow-ups", href: "/dashboard/follow-ups", icon: "◌", permission: "followups.view" },
      { label: "Handoffs", href: "/dashboard/handoffs", icon: "⇄", permission: "messaging.manage" },
      { label: "Appointments", href: "/dashboard/appointments", icon: "□", permission: "reception.view" },
      { label: "Support / Tickets", href: "/dashboard/tickets", icon: "◇", permission: "messaging.view" },
    ],
  },
  {
    title: "Business Operations",
    icon: "▣",
    items: [
      { label: "Operations Overview", href: "/dashboard/business-operations", icon: "⌂", permission: "dashboard.view" },
      { label: "Tasks", href: "/dashboard/tasks", icon: "✓", permission: "tasks.view" },
      { label: "Approvals", href: "/dashboard/approvals", icon: "✓", permission: "messaging.manage" },
      { label: "Automations", href: "/dashboard/automations", icon: "⚙", permission: "automations.view" },
      { label: "Workflows", href: "/dashboard/automations/templates", icon: "⇄", permission: "automations.view" },
      { label: "Inventory", href: "/dashboard/business-operations/inventory", icon: "▦", permission: "dashboard.view" },
      { label: "Documents", href: "/dashboard/business-operations/documents", icon: "▤", permission: "knowledge.view" },
      { label: "Operational Alerts", href: "/dashboard/business-operations/alerts", icon: "!", permission: "dashboard.view" },
    ],
  },
  {
    title: "Intelligence",
    icon: "▥",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: "▥", permission: "analytics.view" },
      { label: "Executive Intelligence", href: "/dashboard/intelligence/executive", icon: "◇", permission: "analytics.view" },
      { label: "Business Performance", href: "/dashboard/intelligence/business-performance", icon: "↗", permission: "analytics.view" },
      { label: "Sales Intelligence", href: "/dashboard/intelligence/sales", icon: "↗", permission: "analytics.view" },
      { label: "Customer Intelligence", href: "/dashboard/intelligence/customers", icon: "◎", permission: "analytics.view" },
      { label: "AI Workforce Analytics", href: "/dashboard/intelligence/ai-workforce", icon: "◈", permission: "workforce.view" },
      { label: "Human Workforce Analytics", href: "/dashboard/intelligence/human-workforce", icon: "♙", permission: "workforce.view" },
      { label: "Operations Analytics", href: "/dashboard/intelligence/operations", icon: "▣", permission: "analytics.view" },
      { label: "Inventory Analytics", href: "/dashboard/intelligence/inventory", icon: "▦", permission: "analytics.view" },
      { label: "Reports", href: "/dashboard/intelligence/reports", icon: "▤", permission: "analytics.view" },
      { label: "Insights & Alerts", href: "/dashboard/intelligence/insights", icon: "!", permission: "analytics.view" },
    ],
  },
  {
    title: "Integrations",
    icon: "⌘",
    items: [
      { label: "Communication Channels", href: "/dashboard/integrations", icon: "✉", permission: "integrations.view", children: ["WhatsApp", "Email", "SMS", "Voice", "Website Chat"] },
      { label: "Social Channels", href: "/dashboard/integrations/meta", icon: "◎", permission: "integrations.view" },
      { label: "Calendar", icon: "□", status: "Coming Soon" },
      { label: "Payments", icon: "$", status: "Planned" },
      { label: "Accounting", icon: "▥", status: "Coming Soon" },
      { label: "CRM", icon: "◇", status: "Coming Soon" },
      { label: "External Apps", icon: "⌘", status: "Planned" },
      { label: "API / Developer Integrations", icon: "{ }", status: "Planned" },
    ],
  },
  {
    title: "Business Brain",
    icon: "◈",
    items: [
      { label: "Business Knowledge", href: "/dashboard/business-brain", icon: "◈", permission: "knowledge.view" },
      { label: "Knowledge Sources", href: "/dashboard/knowledge", icon: "▤", permission: "knowledge.view" },
      { label: "Documents", href: "/dashboard/business-brain/documents", icon: "□", permission: "knowledge.view" },
      { label: "Memory", href: "/dashboard/business-brain/memory", icon: "◉", permission: "knowledge.view" },
      { label: "AI Instructions", href: "/dashboard/settings/ai", icon: "✣", permission: "settings.view" },
      { label: "Knowledge Management", href: "/dashboard/business-brain/management", icon: "▤", permission: "knowledge.manage" },
    ],
  },
  {
    title: "Settings",
    icon: "⚙",
    items: [
      { label: "Business Profile", href: "/dashboard/settings/profile", icon: "◎", permission: "settings.view" },
      { label: "Organization / Business Group", icon: "◇", status: "Coming Soon" },
      { label: "Branches & Locations", icon: "⌖", status: "Coming Soon" },
      { label: "Team Staff", href: "/dashboard/settings/team", icon: "♙", permission: "users.view" },
      { label: "Roles & Permissions", icon: "▣", status: "Planned" },
      { label: "Invitations", icon: "+", status: "Planned" },
      { label: "Security", icon: "◆", status: "Planned" },
      { label: "Billing & Subscription", href: "/dashboard/billing", icon: "$", permission: "billing.view" },
      { label: "Preferences", href: "/dashboard/settings", icon: "⚙", permission: "settings.view" },
    ],
  },
];

const navigationPermissions: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/dashboard/ai-employees": "workforce.view",
  "/dashboard/approvals": "messaging.manage",
  "/dashboard/business-operations": "dashboard.view",
  "/dashboard/workforce": "workforce.view",
  "/dashboard/human-workforce": "workforce.view",
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
  "/dashboard/intelligence/executive": "analytics.view",
  "/dashboard/intelligence/business-performance": "analytics.view",
  "/dashboard/intelligence/sales": "analytics.view",
  "/dashboard/intelligence/customers": "analytics.view",
  "/dashboard/intelligence/ai-workforce": "workforce.view",
  "/dashboard/intelligence/human-workforce": "workforce.view",
  "/dashboard/intelligence/operations": "analytics.view",
  "/dashboard/intelligence/inventory": "analytics.view",
  "/dashboard/intelligence/reports": "analytics.view",
  "/dashboard/intelligence/insights": "analytics.view",
};

const navigationCapabilities: Record<string, string> = {
  "/dashboard/ai-employees": "ai_workforce.core",
  "/dashboard/ai-employees/create": "ai_workforce.builder",
  "/dashboard/workforce/team": "ai_workforce.teams",
  "/dashboard/workforce/deployment": "ai_workforce.deployment",
  "/dashboard/workforce/orchestration": "ai_workforce.orchestration",
  "/dashboard/workforce/monitoring": "ai_workforce.monitoring",
  "/dashboard/ai-performance": "ai_workforce.performance",
  "/dashboard/settings/voice-providers": "ai_workforce.voice",
  "/dashboard/workforce/simulator": "ai_workforce.simulator",
  "/dashboard/workforce-marketplace": "ai_workforce.marketplace",
  "/dashboard/human-workforce": "human_workforce.core",
  "/dashboard/human-workforce/employees": "human_workforce.core",
  "/dashboard/human-workforce/hr": "human_workforce.hr",
  "/dashboard/human-workforce/payroll": "human_workforce.payroll",
  "/dashboard/human-workforce/teams": "human_workforce.teams",
  "/dashboard/inbox": "customer_ops.inbox",
  "/dashboard/customers": "customer_ops.customers",
  "/dashboard/sales": "customer_ops.leads",
  "/dashboard/conversations": "customer_ops.conversations",
  "/dashboard/follow-ups": "customer_ops.followups",
  "/dashboard/handoffs": "customer_ops.handoffs",
  "/dashboard/business-operations": "business_ops.core",
  "/dashboard/tasks": "business_ops.tasks",
  "/dashboard/approvals": "business_ops.approvals",
  "/dashboard/automations": "business_ops.automations",
  "/dashboard/automations/templates": "business_ops.workflows",
  "/dashboard/business-operations/inventory": "business_ops.inventory",
  "/dashboard/business-operations/documents": "business_ops.documents",
  "/dashboard/business-operations/alerts": "business_ops.alerts",
  "/dashboard/analytics": "intelligence.basic",
  "/dashboard/intelligence/executive": "intelligence.advanced",
  "/dashboard/intelligence/business-performance": "intelligence.advanced",
  "/dashboard/intelligence/sales": "intelligence.sales",
  "/dashboard/intelligence/customers": "intelligence.customer",
  "/dashboard/intelligence/ai-workforce": "intelligence.ai_workforce",
  "/dashboard/intelligence/human-workforce": "intelligence.human_workforce",
  "/dashboard/intelligence/operations": "intelligence.operations",
  "/dashboard/intelligence/inventory": "intelligence.inventory",
  "/dashboard/intelligence/reports": "intelligence.reports",
  "/dashboard/intelligence/insights": "intelligence.advanced",
  "/dashboard/integrations": "integrations.core",
  "/dashboard/integrations/meta": "integrations.social",
  "/dashboard/integrations/calendar": "integrations.calendar",
  "/dashboard/integrations/payments": "integrations.payments",
  "/dashboard/integrations/accounting": "integrations.accounting",
  "/dashboard/integrations/crm": "integrations.crm",
  "/dashboard/integrations/external-apps": "integrations.external_apps",
  "/dashboard/integrations/developer": "integrations.developer_api",
  "/dashboard/business-brain": "business_brain.core",
  "/dashboard/knowledge": "business_brain.sources",
  "/dashboard/business-brain/documents": "business_brain.documents",
  "/dashboard/business-brain/memory": "business_brain.memory",
  "/dashboard/settings/ai": "business_brain.instructions",
  "/dashboard/business-brain/management": "business_brain.management",
  "/dashboard/settings/profile": "admin.team_staff",
  "/dashboard/settings/team": "admin.team_staff",
  "/dashboard/billing": "admin.billing",
  "/dashboard/settings": "admin.team_staff",
};

const navigationItemCapabilities: Record<string, string> = {
  "Organization Overview": "command_center.advanced",
  "Branch Overview": "enterprise.organization",
  "Collections Agent": "ai_workforce.collections",
  "Skills": "ai_workforce.builder",
  "Appointments": "customer_ops.appointments",
  "Support / Tickets": "customer_ops.tickets",
  "Calendar": "integrations.calendar",
  "Payments": "integrations.payments",
  "Accounting": "integrations.accounting",
  "CRM": "integrations.crm",
  "External Apps": "integrations.external_apps",
  "API / Developer Integrations": "integrations.developer_api",
  "Organization / Business Group": "enterprise.organization",
  "Branches & Locations": "admin.branches",
  "Roles & Permissions": "admin.roles_permissions",
};

const planNameById = Object.fromEntries(
  planDefinitions.map((plan) => [plan.id, plan.name]),
);

function requiredPlanNameForCapability(capability: string) {
  const planId = capabilityMinimumPlan[capability];
  return planId ? planNameById[planId] : undefined;
}

function isRouteActive(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function activeGroupForPath(pathname: string) {
  return navigationGroups.find((group) =>
    group.items.some((item) => isRouteActive(pathname, item.href)),
  )?.title;
}

function capabilityForPath(pathname: string) {
  const route = Object.keys(navigationCapabilities)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
  return route ? navigationCapabilities[route] : undefined;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [permissions, setPermissions] =
    useState<string[] | null>(null);

  const [entitlements, setEntitlements] =
    useState<BusinessEntitlements | null>(null);

  const [blockedCapability, setBlockedCapability] =
    useState<string | null>(null);

  const [authorizationReady, setAuthorizationReady] =
    useState(false);

  const [role, setRole] =
    useState<string | null>(null);

  const [businesses, setBusinesses] =
    useState<AccessibleBusiness[]>([]);

  const [selectedBusinessId, setSelectedBusinessId] =
    useState("");

  const [switchingBusiness, setSwitchingBusiness] =
    useState(false);

  const [businessSwitchError, setBusinessSwitchError] =
    useState("");

  const [expandedGroups, setExpandedGroups] =
    useState<Record<string, boolean>>({});

  const [mobileNavigationOpen, setMobileNavigationOpen] =
    useState(false);

  const isStaging =
    process.env.NEXT_PUBLIC_APP_ENV === "staging";

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setPermissions([]);
            setAuthorizationReady(true);
          }
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
          setEntitlements(data.membership?.entitlements || null);

          setRole(
            data.membership?.role || null,
          );

          setBusinesses(
            Array.isArray(data.businesses) ? data.businesses : [],
          );

          setSelectedBusinessId(
            data.membership?.businessId || "",
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
          const matchedCapability = capabilityForPath(pathname);

          if (matchedRoute && !userPermissions.includes(navigationPermissions[matchedRoute])) {
            router.replace("/dashboard");
          } else if (matchedCapability && !data.membership?.entitlements?.capabilities?.includes(matchedCapability)) {
            setBlockedCapability(matchedCapability);
          } else {
            setBlockedCapability(null);
          }
          setAuthorizationReady(true);
        }
      } catch {
        if (!cancelled) {
          setPermissions([]);
          setAuthorizationReady(true);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const activeGroup = useMemo(
    () => activeGroupForPath(pathname),
    [pathname],
  );

  const [syncedActiveGroup, setSyncedActiveGroup] =
    useState<string | undefined>(undefined);

  if (activeGroup !== syncedActiveGroup) {
    setSyncedActiveGroup(activeGroup);
    if (activeGroup) {
      setExpandedGroups((current) => ({
        ...current,
        [activeGroup]: true,
      }));
    }
  }

  async function switchBusiness(businessId: string) {
    if (!businessId || businessId === selectedBusinessId || switchingBusiness) {
      return;
    }

    setSwitchingBusiness(true);
    setBusinessSwitchError("");

    try {
      const response = await fetch("/api/businesses/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      if (!response.ok) {
        setBusinessSwitchError("Unable to switch business. Please try again.");
        return;
      }

      setSelectedBusinessId(businessId);
      router.refresh();
      window.location.reload();
    } finally {
      setSwitchingBusiness(false);
    }
  }

  function canShowItem(item: NavigationItem) {
    if (item.ownerOnly && role !== "owner") return false;

    const required = item.permission || (item.href ? navigationPermissions[item.href] : undefined);
    if (required && permissions !== null && !permissions.includes(required)) return false;
    const capability = item.href ? navigationCapabilities[item.href] : navigationItemCapabilities[item.label];
    return !capability || entitlements === null || entitlements.capabilities.includes(capability);
  }

  function toggleGroup(title: string) {
    setExpandedGroups((current) => {
      return { ...current, [title]: !current[title] };
    });
  }

  function renderNavigationGroup(group: NavigationGroup, mobile = false) {
    const items = group.items.filter(canShowItem);
    if (items.length === 0) return null;
    const groupActive = group.title === activeGroup;
    const expanded = Boolean(expandedGroups[group.title]);

    return (
      <section key={group.title} className="mb-1">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => toggleGroup(group.title)}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
            groupActive
              ? "bg-white/[0.08] text-white"
              : "text-white/60 hover:bg-white/[0.04] hover:text-white/85"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
            groupActive
              ? "bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-200"
              : "bg-white/[0.04] text-white/45"
          }`}>
            {group.icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{group.title}</span>
          <span className={`text-[11px] text-white/30 transition-transform ${expanded ? "rotate-90" : ""}`}>
            ›
          </span>
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="ml-7 mt-1 border-l border-white/[0.08] pl-3">
            {items.map((item) => {
              const active = isRouteActive(pathname, item.href);

              if (!item.href) {
                return (
                  <div key={item.label} className="py-1">
                    <div
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/30"
                    >
                      <span className="w-4 text-center text-white/20">{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white/25">
                        {item.status}
                      </span>
                    </div>
                    {item.children && (
                      <div className="ml-7 border-l border-white/[0.06] py-1 pl-3 text-[10px] leading-5 text-white/20">
                        {item.children.map((child) => (
                          <div key={child}>{child}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={`${group.title}-${item.label}`}>
                  <Link
                    href={item.href}
                    onClick={() => mobile && setMobileNavigationOpen(false)}
                    aria-current={active ? "page" : undefined}
                    tabIndex={expanded ? 0 : -1}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition ${
                      active
                        ? "bg-cyan-400/[0.09] text-cyan-100"
                        : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                    }`}
                  >
                    <span className="w-4 text-center text-white/35">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
                  </Link>
                  {item.children && (
                    <div className="ml-7 border-l border-white/[0.06] py-1 pl-3 text-[10px] leading-5 text-white/20">
                      {item.children.map((child) => (
                        <div key={child}>{child}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </section>
    );
  }

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
              width={2172}
              height={724}
              priority
              className="h-auto w-[140px] object-contain"
            />
          </Link>
          {isStaging && (
            <span className="ml-3 rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-200">
              STAGING
            </span>
          )}
        </div>

        {businesses.length > 0 && (
          <div className="border-b border-white/[0.07] px-4 py-3">
            <label htmlFor="business-switcher" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
              Current business
            </label>
            <select
              id="business-switcher"
              value={selectedBusinessId}
              disabled={switchingBusiness}
              onChange={(event) => switchBusiness(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none disabled:opacity-50"
            >
              {!selectedBusinessId && <option value="">Select a business</option>}
              {businesses.map((business) => (
                <option key={business.id} value={business.id} className="bg-[#07070A]">
                  {business.name}
                </option>
              ))}
            </select>
            {businessSwitchError && (
              <p className="mt-2 text-[11px] text-rose-300" role="alert">
                {businessSwitchError}
              </p>
            )}
          </div>
        )}

        {/* Navigation Workspace */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable]">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
            Enterprise workspace
          </p>
          {navigationGroups.map((group) => renderNavigationGroup(group))}
        </nav>

        {/* Bottom Sidebar Section */}
        <div className="border-t border-white/[0.07] p-4">

          <Link
            href="/help"
            className="mt-1.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white/70"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-base text-white/40">
              ?
            </span>

            <span>Help</span>
          </Link>

          <LogoutControl compact />

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
              width={2172}
              height={724}
              priority
              className="h-auto w-[125px] object-contain"
            />
          </Link>

          {isStaging && (
            <span className="rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-200">
              STAGING
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Toggle enterprise navigation"
              aria-expanded={mobileNavigationOpen}
              onClick={() => setMobileNavigationOpen((open) => !open)}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08]"
            >
              <span>{mobileNavigationOpen ? "×" : "☰"}</span>
              <span>Menu</span>
            </button>
          </div>
        </div>

        {mobileNavigationOpen && (
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/[0.07] bg-[#07070A] px-3 py-4">
            {businesses.length > 0 && (
              <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <label htmlFor="mobile-business-switcher" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                  Current business
                </label>
                <select
                  id="mobile-business-switcher"
                  value={selectedBusinessId}
                  disabled={switchingBusiness}
                  onChange={(event) => switchBusiness(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0B0B0F] px-3 py-2 text-xs text-white outline-none disabled:opacity-50"
                >
                  {!selectedBusinessId && <option value="">Select a business</option>}
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <nav aria-label="Enterprise mobile navigation">
              {navigationGroups.map((group) => renderNavigationGroup(group, true))}
            </nav>
            <LogoutControl compact />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="lg:pl-[260px]">
        {!authorizationReady ? (
          <main className="flex min-h-screen items-center justify-center px-6 py-12 text-white/50">Loading workspace access...</main>
        ) : blockedCapability ? (
          <main className="flex min-h-screen items-center justify-center px-6 py-12 text-white">
            <section className="w-full max-w-xl rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70">Upgrade required</p>
              <h1 className="mt-3 text-3xl font-black">{blockedCapability.replace(/[._]/g, " ")}</h1>
              <p className="mt-3 text-sm leading-6 text-white/60">This capability is not included in your current {entitlements?.planName || "plan"} plan. Upgrade to {requiredPlanNameForCapability(blockedCapability) || "a higher plan"} to unlock it for this business.</p>
              <Link href="/dashboard/billing/plans" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black">View plans</Link>
            </section>
          </main>
        ) : children}
      </div>
    </div>
  );
}
