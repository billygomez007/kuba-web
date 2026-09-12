"use client";

import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import WorkforceAnalyticsCenter from "../../components/dashboard/WorkforceAnalyticsCenter";
import MetricCard from "../../components/ui/MetricCard";
import LoadingState from "../../components/ui/LoadingState";
import ErrorState from "../../components/ui/ErrorState";

type PipelineItem = {
  stage: string;
  count: number;
  value: number;
};

type LeadSource = {
  source: string;
  count: number;
  percentage: number;
};

type AnalyticsTrendPoint = {
  key: string;
  label: string;
  leads: number;
  customers: number;
  tasksCompleted: number;
  salesActivities: number;
  wonDeals: number;
  pipelineValue: number;
};

type AnalyticsTrendData = {
  range: "7d" | "30d" | "90d" | "all";
  granularity: "day" | "month";
  trend: AnalyticsTrendPoint[];
  totals: {
    leads: number;
    customers: number;
    tasksCompleted: number;
    salesActivities: number;
    wonDeals: number;
  };
  generatedAt: string;
};

type AnalyticsInsight = {
  type:
    | "sales"
    | "operations"
    | "workforce"
    | "automation";
  title: string;
  message: string;
  priority:
    | "high"
    | "medium"
    | "low";
};

type AnalyticsDeal = {
  id: string;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
  destination: string | null;
  stage: string;
  estimatedValue: number;
  currency: string | null;
  dealStatus: string | null;
  source: string | null;
  createdAt: string | Date;
  closedAt: string | Date | null;
};

type FinancialAnalytics = {
  currency: string;

  pipeline: {
    totalValue: number;
    openValue: number;
    openDeals: number;
  };

  revenue: {
    wonValue: number;
    wonDeals: number;
  };

  losses: {
    lostValue: number;
    lostDeals: number;
  };

  winRate: number;
  totalDeals: number;
  generatedAt: string;
};

type EmployeeAnalytics = {
  id: string;
  name: string;
  type: string;
  status: string;
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  activities: number;
  completionRate: number;
};

type AnalyticsInsightsData = {
  headline: string;
  summary: string;
  insights: AnalyticsInsight[];
  metrics: {
    totalLeads: number;
    qualifiedLeads: number;
    conversionRate: number;
    overdueTasks: number;
    overdueFollowUps: number;
    employees: number;
    successfulAutomations: number;
  };
  generatedAt: string;
};

type AnalyticsData = {
  overview: {
    customers: number;
    newCustomers: number;
    leads: number;
    newLeads: number;
    qualifiedLeads: number;
    conversionRate: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  };

  sales: {
    activities: number;
    pipeline: PipelineItem[];
    pipelineValue: number;
    dealStatus: {
      open: number;
      won: number;
      lost: number;
      openValue: number;
      wonValue: number;
      lostValue: number;
    };
    leadSources: LeadSource[];
  };

  workforce: {
    employees: number;
    activities: number;
  };

  automations: {
    total: number;
    runs: number;
    successfulRuns: number;
    successRate: number;
  };

  communications: {
    conversations: number;
    openConversations: number;
  };

  generatedAt: string;
};

function formatMoney(value: number, currencyCode: string = "GHS", locale: string = "en-GH") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStage(stage: string) {
  return stage
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function PerformanceChart({
  data,
  metric,
}: {
  data: AnalyticsTrendPoint[];
  metric:
    | "leads"
    | "customers"
    | "tasksCompleted"
    | "salesActivities"
    | "wonDeals";
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-white/35">
        No performance data available yet.
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const padding = 36;

  const values = data.map(
    (item) => item[metric],
  );

  const maxValue =
    Math.max(...values, 1);

  function point(
    index: number,
    value: number,
  ) {
    const x =
      padding +
      (index /
        Math.max(data.length - 1, 1)) *
        (width - padding * 2);

    const y =
      height -
      padding -
      (value / maxValue) *
        (height - padding * 2);

    return `${x},${y}`;
  }

  function line() {
    return data
      .map((item, index) =>
        point(
          index,
          item[metric],
        ),
      )
      .join(" ");
  }

  const metricLabels = {
    leads: "Leads",
    customers: "Customers",
    tasksCompleted: "Tasks Completed",
    salesActivities: "Sales Activities",
    wonDeals: "Won Deals",
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-xs text-white/45">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        {metricLabels[metric]}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 min-w-[700px] w-full"
          role="img"
          aria-label="Business performance trend"
        >
          {[0, 25, 50, 75, 100].map(
            (percent) => {
              const y =
                height -
                padding -
                (percent / 100) *
                  (height - padding * 2);

              return (
                <line
                  key={percent}
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-white/[0.06]"
                  strokeWidth="1"
                />
              );
            },
          )}

          <polyline
            points={line()}
            fill="none"
            stroke="currentColor"
            className="text-cyan-400"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map(
            (item, index) => {
              const x =
                padding +
                (index /
                  Math.max(
                    data.length - 1,
                    1,
                  )) *
                  (width -
                    padding * 2);

              const y =
                height -
                padding -
                (item[metric] /
                  maxValue) *
                  (height -
                    padding * 2);

              return (
                <circle
                  key={item.key}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="currentColor"
                  className="text-cyan-400"
                />
              );
            },
          )}

          {data
            .filter(
              (_, index) =>
                data.length <= 10 ||
                index %
                  Math.ceil(
                    data.length / 8,
                  ) ===
                  0 ||
                index ===
                  data.length - 1,
            )
            .map((item) => {
              const index =
                data.findIndex(
                  (entry) =>
                    entry.key ===
                    item.key,
                );

              const x =
                padding +
                (index /
                  Math.max(
                    data.length - 1,
                    1,
                  )) *
                  (width -
                    padding * 2);

              return (
                <text
                  key={`label-${item.key}`}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-white/30 text-[11px]"
                >
                  {item.label}
                </text>
              );
            })}
        </svg>
      </div>

      <p className="mt-3 text-xs text-white/25">
        Showing {metricLabels[metric].toLowerCase()}
        over the selected period.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [trendRange, setTrendRange] =
    useState<"7d" | "30d" | "90d" | "all">("30d");

  const [trendData, setTrendData] =
    useState<AnalyticsTrendData | null>(null);

  const [trendLoading, setTrendLoading] =
    useState(false);

  const [insights, setInsights] =
    useState<AnalyticsInsightsData | null>(null);

  const [insightsLoading, setInsightsLoading] =
    useState(true);

  const [employeeAnalytics, setEmployeeAnalytics] =
    useState<EmployeeAnalytics[]>([]);

  const [employeeAnalyticsLoading, setEmployeeAnalyticsLoading] =
    useState(true);

  const [financialAnalytics, setFinancialAnalytics] =
    useState<FinancialAnalytics | null>(null);

  const [financialAnalyticsLoading, setFinancialAnalyticsLoading] =
    useState(true);

  const [dealDrilldown, setDealDrilldown] =
    useState<
      "open" | "won" | "lost" | null
    >(null);

  const [drilldownDeals, setDrilldownDeals] =
    useState<AnalyticsDeal[]>([]);

  const [drilldownLoading, setDrilldownLoading] =
    useState(false);

  const [trendMetric, setTrendMetric] =
    useState<
      | "leads"
      | "customers"
      | "tasksCompleted"
      | "salesActivities"
      | "wonDeals"
    >("leads");

  const [localization, setLocalization] =
    useState<{ currencyCode: string; locale: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result?.membership?.localization) setLocalization(result.membership.localization);
      })
      .catch(() => { /* falls back to formatMoney's defaults */ });
  }, []);

  function money(value: number) {
    return formatMoney(value, localization?.currencyCode, localization?.locale);
  }

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const response =
          await fetch("/api/analytics", {
            cache: "no-store",
          });

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load analytics.",
          );
        }

        setData(result);
      } catch (err) {
        console.error(
          "Analytics loading error:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load analytics.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDealDrilldown() {
      if (!dealDrilldown) {
        setDrilldownDeals([]);
        return;
      }

      setDrilldownLoading(true);

      try {
        const response =
          await fetch(
            `/api/analytics/deals?status=${dealDrilldown}`,
            {
              cache: "no-store",
            },
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load deals.",
          );
        }

        if (!cancelled) {
          setDrilldownDeals(
            result.deals || [],
          );
        }
      } catch (error) {
        console.error(
          "Analytics drill-down error:",
          error,
        );

        if (!cancelled) {
          setDrilldownDeals([]);
        }
      } finally {
        if (!cancelled) {
          setDrilldownLoading(false);
        }
      }
    }

    loadDealDrilldown();

    return () => {
      cancelled = true;
    };
  }, [dealDrilldown]);

  useEffect(() => {
    let cancelled = false;

    async function loadFinancialAnalytics() {
      setFinancialAnalyticsLoading(true);

      try {
        const response =
          await fetch(
            "/api/analytics/financial",
            {
              cache: "no-store",
            },
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load financial analytics.",
          );
        }

        if (!cancelled) {
          setFinancialAnalytics(
            result,
          );
        }
      } catch (error) {
        console.error(
          "Financial analytics loading error:",
          error,
        );

        if (!cancelled) {
          setFinancialAnalytics(
            null,
          );
        }
      } finally {
        if (!cancelled) {
          setFinancialAnalyticsLoading(
            false,
          );
        }
      }
    }

    loadFinancialAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployeeAnalytics() {
      setEmployeeAnalyticsLoading(true);

      try {
        const response =
          await fetch(
            "/api/analytics/employees",
            {
              cache: "no-store",
            },
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load employee analytics.",
          );
        }

        if (!cancelled) {
          setEmployeeAnalytics(
            result.employees || [],
          );
        }
      } catch (error) {
        console.error(
          "Employee analytics loading error:",
          error,
        );

        if (!cancelled) {
          setEmployeeAnalytics([]);
        }
      } finally {
        if (!cancelled) {
          setEmployeeAnalyticsLoading(false);
        }
      }
    }

    loadEmployeeAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      setInsightsLoading(true);

      try {
        const response =
          await fetch(
            "/api/analytics/insights",
            {
              cache: "no-store",
            },
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load business insights.",
          );
        }

        if (!cancelled) {
          setInsights(result);
        }
      } catch (error) {
        console.error(
          "Analytics insights loading error:",
          error,
        );

        if (!cancelled) {
          setInsights(null);
        }
      } finally {
        if (!cancelled) {
          setInsightsLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTrendData() {
      setTrendLoading(true);

      try {
        const response = await fetch(
          `/api/analytics/trends?range=${trendRange}`,
          {
            cache: "no-store",
          },
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load performance trends.",
          );
        }

        if (!cancelled) {
          setTrendData(result);
        }
      } catch (error) {
        console.error(
          "Analytics trend loading error:",
          error,
        );

        if (!cancelled) {
          setTrendData(null);
        }
      } finally {
        if (!cancelled) {
          setTrendLoading(false);
        }
      }
    }

    loadTrendData();

    return () => {
      cancelled = true;
    };
  }, [trendRange]);

  if (loading) {
    return <LoadingState variant="page" message="Loading business analytics..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        variant="page"
        title="Analytics unavailable"
        message={error || "Unable to load analytics."}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const {
    overview,
    sales,
    workforce,
    automations,
    communications,
  } = data;

  const maxPipelineCount =
    Math.max(
      ...sales.pipeline.map(
        (item) => item.count,
      ),
      1,
    );

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <WorkforceAnalyticsCenter />

        {/* HEADER */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
              Business Intelligence
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-white/40">
              A live view of your business,
              sales pipeline, AI workforce and
              operations.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-white/30">
              Last updated
            </p>

            <p className="mt-1 text-sm font-semibold">
              {new Date(
                data.generatedAt,
              ).toLocaleTimeString()}
            </p>
          </div>
        </div>


        {/* KUBA BUSINESS INSIGHTS */}
        <section className="mt-8">

          <div className="rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.035] p-6">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

              <div className="max-w-3xl">

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />

                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
                    Kuba Business Insights
                  </p>
                </div>

                {insightsLoading ? (

                  <div className="mt-4">
                    <p className="text-sm text-white/35">
                      Kuba is analyzing your business...
                    </p>
                  </div>

                ) : insights ? (

                  <>
                    <h2 className="mt-4 text-xl font-black">
                      {insights.headline}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-white/50">
                      {insights.summary}
                    </p>
                  </>

                ) : (

                  <p className="mt-4 text-sm text-white/35">
                    Business insights are temporarily unavailable.
                  </p>

                )}

              </div>


              {insights && (
                <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">

                  <p className="text-xs text-white/30">
                    Qualification Rate
                  </p>

                  <p className="mt-1 text-2xl font-black text-cyan-300">
                    {insights.metrics.conversionRate}%
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    {insights.metrics.qualifiedLeads} of{" "}
                    {insights.metrics.totalLeads} leads
                  </p>

                </div>
              )}

            </div>


            {insights && insights.insights.length > 0 && (

              <div className="mt-6 grid gap-3 lg:grid-cols-2">

                {insights.insights.map(
                  (insight) => {

                    const priorityClass =
                      insight.priority === "high"
                        ? "border-red-400/20 bg-red-400/[0.04]"
                        : insight.priority === "medium"
                          ? "border-amber-400/20 bg-amber-400/[0.04]"
                          : "border-white/10 bg-white/[0.025]";

                    const priorityText =
                      insight.priority === "high"
                        ? "text-red-300"
                        : insight.priority === "medium"
                          ? "text-amber-300"
                          : "text-emerald-300";

                    return (
                      <div
                        key={`${insight.type}-${insight.title}`}
                        className={`rounded-2xl border p-4 ${priorityClass}`}
                      >

                        <div className="flex items-center justify-between gap-3">

                          <p className="text-sm font-bold">
                            {insight.title}
                          </p>

                          <span
                            className={`text-[10px] font-black uppercase tracking-wider ${priorityText}`}
                          >
                            {insight.priority}
                          </span>

                        </div>

                        <p className="mt-2 text-sm leading-5 text-white/45">
                          {insight.message}
                        </p>

                      </div>
                    );
                  },
                )}

              </div>

            )}

          </div>

        </section>


        {/* PERFORMANCE TRENDS */}
        <section className="mt-8">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
                Performance
              </p>

              <h2 className="mt-2 text-xl font-black">
                Business Performance
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Track how the business is changing over time.
              </p>
            </div>

            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">

              {[
                ["7d", "7 Days"],
                ["30d", "30 Days"],
                ["90d", "90 Days"],
                ["all", "All Time"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setTrendRange(
                      value as "7d" | "30d" | "90d" | "all",
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    trendRange === value
                      ? "bg-cyan-400 text-black"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}

            </div>

          </div>


          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">

            {trendLoading ? (

              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-white/35">
                  Loading performance data...
                </p>
              </div>

            ) : trendData ? (

              <>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs text-white/30">
                      Leads
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {trendData.totals.leads}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs text-white/30">
                      Customers
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {trendData.totals.customers}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs text-white/30">
                      Tasks Completed
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {trendData.totals.tasksCompleted}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs text-white/30">
                      Sales Activities
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {trendData.totals.salesActivities}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs text-white/30">
                      Won Deals
                    </p>

                    <p className="mt-2 text-2xl font-black text-cyan-300">
                      {trendData.totals.wonDeals}
                    </p>
                  </div>

                </div>


                <div className="mt-6 border-t border-white/10 pt-6">

                  <div className="mb-5 flex flex-wrap gap-2">

                    {[
                      ["leads", "Leads"],
                      ["customers", "Customers"],
                      ["tasksCompleted", "Tasks Completed"],
                      ["salesActivities", "Sales Activities"],
                      ["wonDeals", "Won Deals"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setTrendMetric(
                            value as
                              | "leads"
                              | "customers"
                              | "tasksCompleted"
                              | "salesActivities"
                              | "wonDeals",
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                          trendMetric === value
                            ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                            : "border-white/10 text-white/40 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}

                  </div>

                  <PerformanceChart
                    data={trendData.trend}
                    metric={trendMetric}
                  />

                </div>

              </>

            ) : (

              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-white/35">
                  Performance data is unavailable.
                </p>
              </div>

            )}

          </div>

        </section>


        {/* FINANCIAL PERFORMANCE */}
        <section className="mt-8">

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
              Financial Performance
            </p>

            <h2 className="mt-2 text-xl font-black">
              Revenue & Pipeline
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Understand the value currently sitting in the sales pipeline.
            </p>
          </div>


          {financialAnalyticsLoading ? (

            <div className="flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035]">
              <p className="text-sm text-white/35">
                Loading financial data...
              </p>
            </div>

          ) : financialAnalytics ? (

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <button
                type="button"
                onClick={() => setDealDrilldown("open")}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >

                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Pipeline Value
                </p>

                <p className="mt-3 text-2xl font-black">
                  {money(
                    financialAnalytics.pipeline.totalValue,
                  )}
                </p>

                <p className="mt-2 text-xs text-white/30">
                  Open + won opportunities
                </p>

              </button>


              <button
                type="button"
                onClick={() => setDealDrilldown("open")}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >

                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Open Pipeline
                </p>

                <p className="mt-3 text-2xl font-black">
                  {money(
                    financialAnalytics.pipeline.openValue,
                  )}
                </p>

                <p className="mt-2 text-xs text-white/30">
                  {financialAnalytics.pipeline.openDeals} open deal
                  {financialAnalytics.pipeline.openDeals === 1
                    ? ""
                    : "s"}
                </p>

              </button>


              <button
                type="button"
                onClick={() => setDealDrilldown("won")}
                className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.025] p-5 text-left transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.04]"
              >

                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Revenue Won
                </p>

                <p className="mt-3 text-2xl font-black text-emerald-300">
                  {money(
                    financialAnalytics.revenue.wonValue,
                  )}
                </p>

                <p className="mt-2 text-xs text-white/30">
                  {financialAnalytics.revenue.wonDeals} won deal
                  {financialAnalytics.revenue.wonDeals === 1
                    ? ""
                    : "s"}
                </p>

              </button>


              <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] p-5">

                <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Win Rate
                </p>

                <p className="mt-3 text-2xl font-black text-cyan-300">
                  {financialAnalytics.winRate}%
                </p>

                <p className="mt-2 text-xs text-white/30">
                  {financialAnalytics.totalDeals} total deal
                  {financialAnalytics.totalDeals === 1
                    ? ""
                    : "s"}
                </p>

              </div>

            </div>

          ) : (

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <p className="text-sm text-white/35">
                Financial data is currently unavailable.
              </p>
            </div>

          )}


          {financialAnalytics && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                      Lost Business
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {money(
                        financialAnalytics.losses.lostValue,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-white/30">
                      Deals Lost
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {financialAnalytics.losses.lostDeals}
                    </p>
                  </div>

                </div>

              </div>


              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/30">
                      Pipeline Opportunity
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {money(
                        financialAnalytics.pipeline.openValue,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-white/30">
                      Open Deals
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {financialAnalytics.pipeline.openDeals}
                    </p>
                  </div>

                </div>

              </div>

            </div>
          )}

        </section>


        {/* DEAL DRILL-DOWN PANEL */}
        {dealDrilldown && (
          <section className="mt-8">

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">

              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
                    Deal Drill-down
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    {dealDrilldown === "won"
                      ? "Revenue Won"
                      : dealDrilldown === "lost"
                        ? "Lost Business"
                        : "Open Pipeline"}
                  </h2>

                  <p className="mt-1 text-xs text-white/30">
                    Showing the leads behind this analytics figure.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDealDrilldown(null)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Close
                </button>

              </div>


              {drilldownLoading ? (

                <div className="flex h-32 items-center justify-center">
                  <p className="text-sm text-white/35">
                    Loading deals...
                  </p>
                </div>

              ) : drilldownDeals.length === 0 ? (

                <div className="flex h-32 items-center justify-center px-5 text-center">
                  <p className="text-sm text-white/35">
                    No deals found in this category.
                  </p>
                </div>

              ) : (

                <div className="divide-y divide-white/[0.06]">

                  {drilldownDeals.map((deal) => (

                    <div
                      key={deal.id}
                      className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto]"
                    >

                      <div className="min-w-0">

                        <p className="truncate text-sm font-bold">
                          {deal.name ||
                            deal.email ||
                            deal.phone ||
                            "Unnamed lead"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35">

                          {deal.service && (
                            <span>
                              {deal.service}
                            </span>
                          )}

                          {deal.destination && (
                            <span>
                              {deal.destination}
                            </span>
                          )}

                          {deal.source && (
                            <span>
                              Source: {deal.source}
                            </span>
                          )}

                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">

                          <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                            {formatStage(deal.stage)}
                          </span>

                          {deal.dealStatus && (
                            <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                              {deal.dealStatus}
                            </span>
                          )}

                        </div>

                      </div>


                      <div className="text-left lg:text-right">

                        <p className="text-lg font-black">
                          {money(
                            deal.estimatedValue,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-white/30">
                          {deal.currency || "GHS"}
                        </p>

                        {deal.customerId ? (
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href =
                                `/dashboard/customers/${deal.customerId}`;
                            }}
                            className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/50 transition hover:border-cyan-400/20 hover:text-cyan-300"
                          >
                            Open Customer
                          </button>
                        ) : (
                          <span className="mt-3 inline-block text-xs text-white/25">
                            No customer profile
                          </span>
                        )}

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

          </section>
        )}


        {/* AI WORKFORCE PERFORMANCE */}
        <section className="mt-8">

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
              AI Workforce
            </p>

            <h2 className="mt-2 text-xl font-black">
              Employee Performance
            </h2>

            <p className="mt-1 text-sm text-white/35">
              See how each AI employee is handling assigned work.
            </p>
          </div>


          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">

            {employeeAnalyticsLoading ? (

              <div className="flex h-40 items-center justify-center">
                <p className="text-sm text-white/35">
                  Loading workforce performance...
                </p>
              </div>

            ) : employeeAnalytics.length === 0 ? (

              <EmptyState
                icon="✦"
                title="Measure the impact of your AI workforce"
                description="Create an AI employee to start tracking activity, outcomes, and operational performance."
                actionLabel="Create AI Employee"
                actionHref="/dashboard/workforce"
                className="m-4"
                compact
              />

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[760px]">

                  <thead>
                    <tr className="border-b border-white/10 text-left">

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Employee
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Status
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Tasks
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Completed
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Activities
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/30">
                        Completion
                      </th>

                    </tr>
                  </thead>


                  <tbody>

                    {employeeAnalytics.map(
                      (employee) => (
                        <tr
                          key={employee.id}
                          className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025]"
                        >

                          <td className="px-5 py-4">

                            <div>
                              <p className="text-sm font-bold">
                                {employee.name}
                              </p>

                              <p className="mt-1 text-xs capitalize text-white/30">
                                {employee.type.replace(
                                  /[_-]/g,
                                  " ",
                                )}
                              </p>
                            </div>

                          </td>


                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                employee.status === "active"
                                  ? "bg-emerald-400/10 text-emerald-300"
                                  : "bg-white/10 text-white/40"
                              }`}
                            >
                              {employee.status}
                            </span>

                          </td>


                          <td className="px-5 py-4 text-sm font-bold">
                            {employee.tasks.total}
                          </td>


                          <td className="px-5 py-4">

                            <div>
                              <p className="text-sm font-bold">
                                {employee.tasks.completed}
                              </p>

                              {employee.tasks.overdue > 0 && (
                                <p className="mt-1 text-xs text-red-300">
                                  {employee.tasks.overdue} overdue
                                </p>
                              )}
                            </div>

                          </td>


                          <td className="px-5 py-4 text-sm font-bold">
                            {employee.activities}
                          </td>


                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">

                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${Math.min(
                                      employee.completionRate,
                                      100,
                                    )}%`,
                                  }}
                                />

                              </div>

                              <span className="text-sm font-bold">
                                {employee.completionRate}%
                              </span>

                            </div>

                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>


        {/* BUSINESS OVERVIEW */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Business Overview
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Your most important operating numbers.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Customers"
              value={overview.customers}
              description={`${overview.newCustomers} new this month`}
            />

            <MetricCard
              label="Leads"
              value={overview.leads}
              description={`${overview.newLeads} new this month`}
            />

            <MetricCard
              label="Qualified Leads"
              value={overview.qualifiedLeads}
              description={`${overview.conversionRate}% of all leads`}
            />

            <MetricCard
              label="Sales Activities"
              value={sales.activities}
              description="Recorded sales activity"
            />
          </div>
        </section>


        {/* SALES PIPELINE */}
        <section className="mt-8">

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">
                Sales Pipeline
              </h2>

              <p className="mt-1 text-sm text-white/35">
                Live distribution of leads across
                your sales stages.
              </p>
            </div>

            <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] px-4 py-3">
              <p className="text-xs text-white/35">
                Estimated Pipeline Value
              </p>

              <p className="mt-1 text-lg font-black text-cyan-300">
                {money(
                  sales.pipelineValue,
                )}
              </p>
            </div>
          </div>


          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

            {sales.pipeline.length === 0 ? (
              <EmptyState
                icon="↗"
                title="See opportunities move through your pipeline"
                description="Connect a channel or activate your AI Sales Assistant to capture and qualify demand."
                actionLabel="Open Sales"
                actionHref="/dashboard/sales"
                compact
              />
            ) : (
              <div className="space-y-5">

                {sales.pipeline.map(
                  (item) => {
                    const width =
                      Math.max(
                        (item.count /
                          maxPipelineCount) *
                          100,
                        4,
                      );

                    return (
                      <div
                        key={item.stage}
                      >

                        <div className="mb-2 flex items-center justify-between gap-4">

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">
                              {formatStage(
                                item.stage,
                              )}
                            </span>

                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/40">
                              {item.count}
                            </span>
                          </div>

                          <span className="text-xs text-white/40">
                            {money(
                              item.value,
                            )}
                          </span>

                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{
                              width: `${width}%`,
                            }}
                          />
                        </div>

                      </div>
                    );
                  },
                )}

              </div>
            )}

          </div>
        </section>


        {/* DEAL STATUS */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Deal Performance
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Open, won and lost opportunities.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">

            <MetricCard
              label="Open Deals"
              value={sales.dealStatus.open}
              description={money(
                sales.dealStatus.openValue,
              )}
            />

            <MetricCard
              label="Won Deals"
              value={sales.dealStatus.won}
              description={money(
                sales.dealStatus.wonValue,
              )}
            />

            <MetricCard
              label="Lost Deals"
              value={sales.dealStatus.lost}
              description={money(
                sales.dealStatus.lostValue,
              )}
            />

          </div>
        </section>


        {/* LEAD SOURCES */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Lead Sources
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Where your opportunities are coming from.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

            {sales.leadSources.length === 0 ? (
              <EmptyState
                icon="◎"
                title="Discover which channels drive growth"
                description="Connect customer channels to see where qualified leads and opportunities originate."
                actionLabel="Connect Integration"
                actionHref="/dashboard/integrations"
                compact
              />
            ) : (
              <div className="space-y-4">

                {sales.leadSources.map(
                  (item) => (
                    <div
                      key={item.source}
                      className="flex items-center gap-4"
                    >

                      <div className="w-28 shrink-0">
                        <p className="truncate text-sm font-semibold">
                          {item.source}
                        </p>
                      </div>

                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-white/40"
                            style={{
                              width: `${Math.max(
                                item.percentage,
                                2,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="w-20 text-right">
                        <p className="text-sm font-bold">
                          {item.count}
                        </p>

                        <p className="text-xs text-white/30">
                          {item.percentage}%
                        </p>
                      </div>

                    </div>
                  ),
                )}

              </div>
            )}

          </div>
        </section>


        {/* TASKS */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Tasks & Follow-ups
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Operational workload across the business.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <MetricCard
              label="Completed Tasks"
              value={overview.completedTasks}
            />

            <MetricCard
              label="Pending Tasks"
              value={overview.pendingTasks}
            />

            <MetricCard
              label="Overdue Tasks"
              value={overview.overdueTasks}
              description="Requires attention"
            />

            <MetricCard
              label="Pending Follow-ups"
              value={overview.pendingFollowUps}
              description={`${overview.overdueFollowUps} overdue`}
            />

          </div>
        </section>


        {/* AI WORKFORCE */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-bold">
              AI Workforce
            </h2>

            <p className="mt-1 text-sm text-white/35">
              Activity generated by your AI employees.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <MetricCard
              label="AI Employees"
              value={workforce.employees}
              description="Configured workforce"
            />

            <MetricCard
              label="AI Activities"
              value={workforce.activities}
              description="Recorded AI work"
            />

          </div>
        </section>


        {/* COMMUNICATIONS + AUTOMATIONS */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

            <p className="text-xs font-bold uppercase tracking-wider text-white/35">
              Communications
            </p>

            <p className="mt-3 text-3xl font-black">
              {communications.conversations}
            </p>

            <p className="mt-1 text-sm text-white/35">
              Total conversations
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm text-white/40">
                Open conversations
              </span>

              <span className="font-bold">
                {communications.openConversations}
              </span>
            </div>

          </div>


          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">

            <p className="text-xs font-bold uppercase tracking-wider text-white/35">
              Automations
            </p>

            <p className="mt-3 text-3xl font-black">
              {automations.total}
            </p>

            <p className="mt-1 text-sm text-white/35">
              Automation records
            </p>

            <div className="mt-5 space-y-3 border-t border-white/10 pt-4">

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">
                  Runs
                </span>

                <span className="font-bold">
                  {automations.runs}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">
                  Successful
                </span>

                <span className="font-bold">
                  {automations.successfulRuns}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">
                  Success rate
                </span>

                <span className="font-bold text-cyan-300">
                  {automations.successRate}%
                </span>
              </div>

            </div>

          </div>

        </section>


        {/* KUBA INSIGHT */}
        <section className="mt-8 rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.035] p-6">

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
            Kuba Insight
          </p>

          <h2 className="mt-3 text-xl font-black">
            Business performance at a glance
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
            Your business currently has{" "}
            <span className="font-bold text-white">
              {overview.leads}
            </span>{" "}
            leads, including{" "}
            <span className="font-bold text-white">
              {overview.qualifiedLeads}
            </span>{" "}
            qualified opportunities. The estimated
            sales pipeline is{" "}
            <span className="font-bold text-white">
              {money(
                sales.pipelineValue,
              )}
            </span>
            .
          </p>

        </section>

      </div>
    </main>
  );
}
