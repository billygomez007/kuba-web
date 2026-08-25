import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, gte, lte } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  leads,
  customers,
  tasks,
  salesActivities,
} from "@/db/schema";

type Range = "7d" | "30d" | "90d" | "all";

function getRange(value: string | null): Range {
  if (
    value === "7d" ||
    value === "30d" ||
    value === "90d"
  ) {
    return value;
  }

  return "30d";
}

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStartDate(
  range: Range,
  now: Date,
) {
  if (range === "all") {
    return null;
  }

  const days =
    range === "7d"
      ? 6
      : range === "30d"
        ? 29
        : 89;

  const start =
    startOfDay(now);

  start.setDate(
    start.getDate() - days,
  );

  return start;
}

function dateKey(date: Date) {
  return startOfDay(
    date,
  ).getTime();
}

export async function GET(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    const url =
      new URL(request.url);

    const range =
      getRange(
        url.searchParams.get(
          "range",
        ),
      );

    const now =
      new Date();

    const startDate =
      getStartDate(
        range,
        now,
      );

    const businessId =
      business.businessId;

    const leadConditions = [
      eq(
        leads.businessId,
        businessId,
      ),
    ];

    const customerConditions = [
      eq(
        customers.businessId,
        businessId,
      ),
    ];

    const taskConditions = [
      eq(
        tasks.businessId,
        businessId,
      ),
    ];

    const activityConditions = [
      eq(
        salesActivities.businessId,
        businessId,
      ),
    ];

    if (startDate) {
      leadConditions.push(
        gte(
          leads.createdAt,
          startDate,
        ),
      );

      customerConditions.push(
        gte(
          customers.createdAt,
          startDate,
        ),
      );

      taskConditions.push(
        gte(
          tasks.createdAt,
          startDate,
        ),
      );

      activityConditions.push(
        gte(
          salesActivities.createdAt,
          startDate,
        ),
      );
    }

    const [
      rangeLeads,
      rangeCustomers,
      rangeTasks,
      rangeActivities,
    ] = await Promise.all([
      db
        .select({
          createdAt:
            leads.createdAt,
          stage:
            leads.stage,
          estimatedValue:
            leads.estimatedValue,
          dealStatus:
            leads.dealStatus,
        })
        .from(leads)
        .where(
          and(
            ...leadConditions,
          ),
        ),

      db
        .select({
          createdAt:
            customers.createdAt,
        })
        .from(customers)
        .where(
          and(
            ...customerConditions,
          ),
        ),

      db
        .select({
          createdAt:
            tasks.createdAt,
          completedAt:
            tasks.completedAt,
          status:
            tasks.status,
        })
        .from(tasks)
        .where(
          and(
            ...taskConditions,
          ),
        ),

      db
        .select({
          createdAt:
            salesActivities.createdAt,
        })
        .from(salesActivities)
        .where(
          and(
            ...activityConditions,
          ),
        ),
    ]);

    /*
     * Build the daily buckets.
     *
     * For "all time", use monthly buckets
     * so the chart remains readable.
     */
    const useMonthly =
      range === "all";

    const buckets =
      new Map<
        string,
        {
          label: string;
          leads: number;
          customers: number;
          tasksCompleted: number;
          salesActivities: number;
          wonDeals: number;
          pipelineValue: number;
        }
      >();

    function bucketKey(
      date: Date,
    ) {
      if (useMonthly) {
        return `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;
      }

      return `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
    }

    function bucketLabel(
      date: Date,
    ) {
      if (useMonthly) {
        return date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            year: "numeric",
          },
        );
      }

      return formatDay(date);
    }

    function ensureBucket(
      date: Date,
    ) {
      const key =
        bucketKey(date);

      if (!buckets.has(key)) {
        buckets.set(key, {
          label:
            bucketLabel(date),
          leads: 0,
          customers: 0,
          tasksCompleted: 0,
          salesActivities: 0,
          wonDeals: 0,
          pipelineValue: 0,
        });
      }

      return buckets.get(
        key,
      )!;
    }

    if (useMonthly) {
      const firstDate =
        startDate ||
        rangeLeads[0]?.createdAt ||
        rangeCustomers[0]?.createdAt ||
        now;

      const cursor =
        new Date(firstDate);

      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);

      const end =
        new Date(now);

      end.setDate(1);
      end.setHours(0, 0, 0, 0);

      while (
        cursor <= end
      ) {
        ensureBucket(
          new Date(cursor),
        );

        cursor.setMonth(
          cursor.getMonth() + 1,
        );
      }
    } else {
      const firstDate =
        startDate ||
        startOfDay(now);

      const cursor =
        new Date(firstDate);

      const end =
        startOfDay(now);

      while (
        cursor <= end
      ) {
        ensureBucket(
          new Date(cursor),
        );

        cursor.setDate(
          cursor.getDate() + 1,
        );
      }
    }

    for (const lead of rangeLeads) {
      const date =
        new Date(
          lead.createdAt,
        );

      const bucket =
        ensureBucket(date);

      bucket.leads += 1;

      const value =
        Number(
          String(
            lead.estimatedValue ||
              "0",
          ).replace(
            /[^0-9.-]/g,
            "",
          ),
        ) || 0;

      bucket.pipelineValue +=
        value;

      const dealStatus =
        String(
          lead.dealStatus ||
            "open",
        ).toLowerCase();

      if (
        dealStatus === "won" ||
        dealStatus === "closed_won"
      ) {
        bucket.wonDeals += 1;
      }
    }

    for (const customer of rangeCustomers) {
      const bucket =
        ensureBucket(
          new Date(
            customer.createdAt,
          ),
        );

      bucket.customers += 1;
    }

    for (const task of rangeTasks) {
      if (
        task.status ===
          "completed" &&
        task.completedAt
      ) {
        const bucket =
          ensureBucket(
            new Date(
              task.completedAt,
            ),
          );

        bucket.tasksCompleted += 1;
      }
    }

    for (const activity of rangeActivities) {
      const bucket =
        ensureBucket(
          new Date(
            activity.createdAt,
          ),
        );

      bucket.salesActivities +=
        1;
    }

    const trend =
      Array.from(
        buckets.entries(),
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(b),
        )
        .map(
          ([key, value]) => ({
            key,
            ...value,
          }),
        );

    return NextResponse.json({
      range,

      granularity:
        useMonthly
          ? "month"
          : "day",

      trend,

      totals: {
        leads:
          rangeLeads.length,

        customers:
          rangeCustomers.length,

        tasksCompleted:
          rangeTasks.filter(
            (task) =>
              task.status ===
                "completed" &&
              task.completedAt,
          ).length,

        salesActivities:
          rangeActivities.length,

        wonDeals:
          rangeLeads.filter(
            (lead) => {
              const status =
                String(
                  lead.dealStatus ||
                    "",
                ).toLowerCase();

              return (
                status === "won" ||
                status ===
                  "closed_won"
              );
            },
          ).length,
      },

      generatedAt:
        now.toISOString(),
    });
  } catch (error) {
    console.error(
      "Analytics trends error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load analytics trends.",
      },
      {
        status: 500,
      },
    );
  }
}
