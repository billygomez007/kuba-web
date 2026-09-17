"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { capabilityMinimumPlan, planDefinitions } from "@/lib/billing/plan-definitions";
import { getCatalogEntry } from "@/lib/billing/ai-workforce-catalog";
import TrialBanner from "../components/dashboard/TrialBanner";

type NavigationItem = {
  label: string;
  // Required, not optional: the operational sidebar shows only features a
  // customer can actually use right now. A feature that isn't implemented
  // yet has no href and therefore cannot appear here at all — it belongs on
  // the AI Workforce catalog / pricing page / upgrade screens instead, never
  // as an unusable placeholder row in this sidebar. See canShowItem below:
  // visibility is permission AND entitlement AND (by construction, since
  // only implemented surfaces are ever listed here) implementation
  // availability.
  href: string;
  icon: string;
  ownerOnly?: boolean;
  permission?: string;
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
      { label: "Business Overview", href: "/dashboard", icon: "⌂" },
    ],
  },
  {
    title: "AI Workforce",
    icon: "✦",
    items: [
      { label: "AI Employees", href: "/dashboard/ai-employees", icon: "✦", permission: "workforce.view" },
      { label: "Outreach Campaigns", href: "/dashboard/outreach/campaigns", icon: "▶", permission: "outreach.view" },
      { label: "AI Employee Builder", href: "/dashboard/ai-employees/create", icon: "+", permission: "workforce.view" },
      { label: "AI Teams", href: "/dashboard/workforce/team", icon: "♙", permission: "workforce.view" },
      { label: "Deployment", href: "/dashboard/workforce/deployment", icon: "⇧", permission: "workforce.view" },
      { label: "Orchestration", href: "/dashboard/workforce/orchestration", icon: "⇄", permission: "workforce.view" },
      { label: "Monitoring", href: "/dashboard/workforce/monitoring", icon: "◉", permission: "workforce.view" },
      { label: "AI Workforce Performance", href: "/dashboard/ai-performance", icon: "▥", permission: "workforce.view" },
      { label: "Voice", href: "/dashboard/voice", icon: "◖", permission: "workforce.view" },
      { label: "Simulator", href: "/dashboard/workforce/simulator", icon: "◌", permission: "workforce.view" },
      { label: "Marketplace", href: "/dashboard/workforce-marketplace", icon: "◫", permission: "workforce.view" },
    ],
  },
  {
    title: "Marketing",
    icon: "◈",
    items: [
      { label: "Marketing Overview", href: "/dashboard/marketing", icon: "◈", permission: "marketing.view" },
      { label: "Campaigns", href: "/dashboard/marketing/campaigns", icon: "▶", permission: "marketing.view" },
      { label: "Content Studio", href: "/dashboard/marketing/content", icon: "✎", permission: "marketing.view" },
      { label: "Content Calendar", href: "/dashboard/marketing/calendar", icon: "□", permission: "marketing.view" },
      { label: "Approvals", href: "/dashboard/marketing/approvals", icon: "✓", permission: "marketing.view" },
      { label: "Audiences", href: "/dashboard/marketing/audiences", icon: "◎", permission: "marketing.view" },
      { label: "Assets", href: "/dashboard/marketing/assets", icon: "▧", permission: "marketing.view" },
      { label: "Social accounts", href: "/dashboard/marketing/social", icon: "↗", permission: "marketing.view" },
      { label: "Analytics", href: "/dashboard/marketing/analytics", icon: "▥", permission: "marketing.view" },
    ],
  },
  {
    title: "Human Workforce",
    icon: "♙",
    items: [
      { label: "Workforce Overview", href: "/dashboard/human-workforce", icon: "⌂", permission: "workforce.view" },
      { label: "Employees", href: "/dashboard/human-workforce/employees", icon: "◎", permission: "workforce.view" },
      { label: "HR", href: "/dashboard/human-workforce/hr", icon: "▤", permission: "workforce.view", children: ["Employee Records", "Departments", "Positions", "Contracts", "Documents", "Attendance", "Leave"] },
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
      { label: "CRM", href: "/dashboard/crm", icon: "◎", permission: "crm.view" },
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
      { label: "Insights & Alerts", href: "/dashboard/intelligence/insights", icon: "!", permission: "analytics.view" },
    ],
  },
  {
    title: "Integrations",
    icon: "⌘",
    items: [
      { label: "Communication Channels", href: "/dashboard/integrations", icon: "✉", permission: "integrations.view", children: ["WhatsApp", "Email", "SMS", "Voice", "Website Chat"] },
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
      { label: "Team Staff", href: "/dashboard/settings/team", icon: "♙", permission: "users.view" },
      { label: "Billing & Subscription", href: "/dashboard/billing", icon: "$", permission: "billing.view" },
      { label: "Preferences", href: "/dashboard/settings", icon: "⚙", permission: "settings.view" },
    ],
  },
];

const navigationPermissions: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/dashboard/ai-employees": "workforce.view",
  "/dashboard/outreach/campaigns": "outreach.view",
  "/dashboard/marketing": "marketing.view",
  "/dashboard/marketing/campaigns": "marketing.view",
  "/dashboard/marketing/content": "marketing.view",
  "/dashboard/marketing/calendar": "marketing.view",
  "/dashboard/marketing/approvals": "marketing.view",
  "/dashboard/marketing/audiences": "marketing.view",
  "/dashboard/marketing/assets": "marketing.view",
  "/dashboard/marketing/social": "marketing.view",
  "/dashboard/marketing/analytics": "marketing.view",
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
  "/dashboard/ai-performance": "workforce.view",
  "/dashboard/workforce-command-center": "workforce.view",
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
  "/dashboard/intelligence/insights": "analytics.view",
};

const navigationCapabilities: Record<string, string> = {
  "/dashboard/ai-employees": "ai_workforce.core",
  "/dashboard/outreach/campaigns": "outreach.campaigns",
  "/dashboard/marketing": "marketing.native",
  "/dashboard/marketing/campaigns": "marketing.native",
  "/dashboard/marketing/content": "marketing.native",
  "/dashboard/marketing/calendar": "marketing.native",
  "/dashboard/marketing/approvals": "marketing.native",
  "/dashboard/marketing/audiences": "marketing.native",
  "/dashboard/marketing/assets": "marketing.native",
  "/dashboard/marketing/social": "marketing.native",
  "/dashboard/marketing/analytics": "marketing.native",
  "/dashboard/ai-employees/create": "ai_workforce.builder",
  "/dashboard/workforce/team": "ai_workforce.teams",
  "/dashboard/workforce/deployment": "ai_workforce.deployment",
  "/dashboard/workforce/orchestration": "ai_workforce.orchestration",
  "/dashboard/workforce/monitoring": "ai_workforce.monitoring",
  "/dashboard/ai-performance": "ai_workforce.performance",
  "/dashboard/workforce-command-center": "ai_workforce.performance",
  "/dashboard/settings/voice-providers": "ai_workforce.voice",
  "/dashboard/voice": "ai_workforce.voice",
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
  "/dashboard/appointments": "customer_ops.appointments",
  "/dashboard/crm": "integrations.crm",
  "/dashboard/tickets": "customer_ops.tickets",
  "/dashboard/business-operations": "business_ops.core",
  "/dashboard/tasks": "business_ops.tasks",
  "/dashboard/approvals": "business_ops.approvals",
  "/dashboard/automations": "business_ops.automations",
  "/dashboard/automations/templates": "business_ops.workflows",
  "/dashboard/business-operations/alerts": "business_ops.alerts",
  "/dashboard/analytics": "intelligence.basic",
  "/dashboard/intelligence/executive": "intelligence.advanced",
  "/dashboard/intelligence/business-performance": "intelligence.advanced",
  "/dashboard/intelligence/sales": "intelligence.sales",
  "/dashboard/intelligence/customers": "intelligence.customer",
  "/dashboard/intelligence/ai-workforce": "intelligence.ai_workforce",
  "/dashboard/intelligence/human-workforce": "intelligence.human_workforce",
  "/dashboard/intelligence/operations": "intelligence.operations",
  "/dashboard/intelligence/insights": "intelligence.advanced",
  "/dashboard/integrations": "integrations.core",
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

const planNameById = Object.fromEntries(
  planDefinitions.map((plan) => [plan.id, plan.name]),
);

function requiredPlanNameForCapability(capability: string) {
  const planId = capabilityMinimumPlan[capability];
  return planId ? planNameById[planId] : undefined;
}

// A capability tied to a specific AI employee gets its upgrade copy from
// that employee's own catalog entry (name/description/capabilities) instead
// of a generic "capability name, upgrade to X" message — reuses the single
// existing copy source (lib/billing/ai-workforce-catalog.ts) rather than
// hand-writing a second description. Extend this map only for capabilities
// that really do correspond to one specific employee; most capabilities
// (e.g. business_ops.workflows) have no single employee to name and should
// keep the generic message below.
const capabilityEmployeeType: Partial<Record<string, string>> = {
  "outreach.campaigns": "outreach",
};

function capabilityUpgradeCopy(capability: string): { title: string; description: string; benefits: string[] } | null {
  const employeeType = capabilityEmployeeType[capability];
  const entry = employeeType ? getCatalogEntry(employeeType) : undefined;
  if (!entry) return null;
  return { title: `Unlock ${entry.name}`, description: entry.description, benefits: entry.capabilities };
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

  // Distinct from "permissions is an empty array because this account
  // genuinely has none" — set only when the request that loads permissions/
  // entitlements itself fails (network error, non-2xx response). An empty
  // permissions array on a successful response is a legitimate state
  // (canShowItem correctly hides everything); a failed request is not, and
  // must never silently render the same way. See the sidebar's own render
  // branch below.
  const [navigationLoadError, setNavigationLoadError] =
    useState<string | null>(null);

  const [blockedCapability, setBlockedCapability] =
    useState<string | null>(null);

  const [authorizationReady, setAuthorizationReady] =
    useState(false);

  const [role, setRole] =
    useState<string | null>(null);

  const [businesses, setBusinesses] =
    useState<AccessibleBusiness[]>([]);

  const [hasPortfolio, setHasPortfolio] =
    useState(false);

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

  const loadPermissions = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        // A failed request is NOT the same state as "this account has no
        // permissions" — permissions/entitlements/role are deliberately
        // left untouched (never forced to an empty array) so a stale-but-
        // valid previous nav doesn't silently look emptier than it should,
        // and so canShowItem's permission gate (which only activates once
        // `permissions !== null`) never mistakes "failed to load" for
        // "loaded, and there is nothing." See navigationLoadError below.
        setNavigationLoadError(
          `Unable to load your navigation (${response.status}). Try refreshing the page.`,
        );
        return;
      }

      const data = await response.json();

      // Authenticated, but no workspace yet — the normal state right after
      // signup, before onboarding creates a business. This is NOT a load
      // failure (navigationLoadError stays clear) and NOT "this plan has
      // no navigation" — it's a distinct third state that gets its own
      // recovery: send them to onboarding rather than showing an empty,
      // unexplained sidebar.
      if (data.code === "NO_BUSINESS_MEMBERSHIP") {
        setNavigationLoadError(null);
        router.replace("/onboarding");
        return;
      }

      const userPermissions = Array.isArray(
        data.membership?.permissions,
      )
        ? data.membership.permissions
        : [];

      setNavigationLoadError(null);
      setPermissions(userPermissions);
      setEntitlements(data.membership?.entitlements || null);

      setRole(
        data.membership?.role || null,
      );

      setBusinesses(
        Array.isArray(data.businesses) ? data.businesses : [],
      );

      setHasPortfolio(
        Array.isArray(data.organizations) && data.organizations.length > 0,
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
    } catch {
      setNavigationLoadError(
        "Unable to load your navigation. Check your connection and try again.",
      );
    } finally {
      // Marks authorization "ready" on both success and failure — a failed
      // request gets a clear error state to show (navigationLoadError),
      // never an infinite loading spinner.
      setAuthorizationReady(true);
    }
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadPermissions();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPermissions]);

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

  // visibleInSidebar = hasRequiredPermission AND hasRequiredEntitlement.
  // Implementation availability is the third, unconditional gate: it's
  // enforced structurally, not per-request — a feature with no working
  // product surface simply has no entry in navigationGroups at all (see
  // that array's own comment), so there is nothing left to check for it
  // here. A feature discoverable-but-not-yet-usable (a locked AI employee,
  // a higher-plan capability) belongs on the AI Workforce catalog / pricing
  // page / upgrade screen, never in this list.
  function canShowItem(item: NavigationItem) {
    if (item.ownerOnly && role !== "owner") return false;

    const required = item.permission || navigationPermissions[item.href];
    if (required && permissions !== null && !permissions.includes(required)) return false;
    const capability = navigationCapabilities[item.href];
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
            <Link
              href="/dashboard/businesses/new"
              className="mt-2 block text-[11px] font-semibold text-cyan-300/70 hover:text-cyan-300"
            >
              + Add business
            </Link>
            {hasPortfolio && (
              <Link
                href="/dashboard/portfolio"
                className="mt-1 block text-[11px] font-semibold text-white/40 hover:text-white/70"
              >
                View portfolio →
              </Link>
            )}
          </div>
        )}

        {/* Navigation Workspace */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable]">
          {/* This label previously said "Enterprise workspace" unconditionally
              for every plan — pure static copy, never derived from the
              business's actual plan, but misleading regardless. Now reflects
              the real resolved business name and plan, so a user who
              belongs to multiple businesses always knows which tenant
              they're currently operating in (never just "Workspace"). */}
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
            {(() => {
              const current = businesses.find((business) => business.id === selectedBusinessId);
              if (current && entitlements) return `${current.name} — ${entitlements.planName} workspace`;
              if (current) return current.name;
              return entitlements ? `${entitlements.planName} workspace` : "Workspace";
            })()}
          </p>
          {navigationLoadError ? (
            <div className="mx-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-200">
              <p>{navigationLoadError}</p>
              <button
                type="button"
                onClick={() => void loadPermissions()}
                className="mt-2 rounded-lg border border-amber-300/30 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-300/10"
              >
                Retry
              </button>
            </div>
          ) : (
            navigationGroups.map((group) => renderNavigationGroup(group))
          )}
        </nav>

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
              aria-label="Toggle dashboard navigation"
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
                <Link
                  href="/dashboard/businesses/new"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="mt-2 block text-[11px] font-semibold text-cyan-300/70 hover:text-cyan-300"
                >
                  + Add business
                </Link>
                {hasPortfolio && (
                  <Link
                    href="/dashboard/portfolio"
                    onClick={() => setMobileNavigationOpen(false)}
                    className="mt-1 block text-[11px] font-semibold text-white/40 hover:text-white/70"
                  >
                    View portfolio →
                  </Link>
                )}
              </div>
            )}
            <nav aria-label="Dashboard mobile navigation">
              {navigationLoadError ? (
                <div className="mx-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-200">
                  <p>{navigationLoadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPermissions()}
                    className="mt-2 rounded-lg border border-amber-300/30 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-300/10"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                navigationGroups.map((group) => renderNavigationGroup(group, true))
              )}
            </nav>
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
              {(() => {
                const copy = capabilityUpgradeCopy(blockedCapability);
                return copy ? (
                  <>
                    <h1 className="mt-3 text-3xl font-black">{copy.title}</h1>
                    <p className="mt-3 text-sm leading-6 text-white/60">{copy.description}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {copy.benefits.map((benefit) => (
                        <li key={benefit} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
                          {benefit}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm leading-6 text-white/60">
                      Available on <span className="font-bold text-amber-200">{requiredPlanNameForCapability(blockedCapability) || "a higher plan"}</span>.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="mt-3 text-3xl font-black">{blockedCapability.replace(/[._]/g, " ")}</h1>
                    <p className="mt-3 text-sm leading-6 text-white/60">This capability is not included in your current {entitlements?.planName || "plan"} plan. Upgrade to {requiredPlanNameForCapability(blockedCapability) || "a higher plan"} to unlock it for this business.</p>
                  </>
                );
              })()}
              <Link href="/dashboard/billing/plans" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black">View plans</Link>
            </section>
          </main>
        ) : (
          <>
            <TrialBanner />
            {children}
          </>
        )}
      </div>
    </div>
  );
}
