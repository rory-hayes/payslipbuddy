"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/catalyst/badge";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";
import type { MomDiff } from "@/lib/types/domain";

interface DashboardOverview {
  user: {
    region: "UK" | "IE";
    currency: "GBP" | "EUR";
    plan: string;
  };
  usage: {
    plan: string;
    subscriptionStatus: string;
    freePayslipsUsed: number;
    freePayslipsLimit: number;
    unlimitedPayslips: boolean;
  } | null;
  latestPayslip: {
    periodMonth: number;
    periodYear: number;
  } | null;
  latestBreakdown: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
  } | null;
  momDiff: MomDiff[];
  lineItemChanges: Array<{
    label: string;
    type: string;
    delta: number;
    isNew: boolean;
    isIrregular: boolean;
  }>;
  monthlySeries: Array<{
    month: string;
    gross: number;
    net: number;
    tax: number;
    pension: number;
    niOrPrsi: number;
    usc: number;
  }>;
  budgetSnapshot: {
    monthlyIncome: number;
    suggestedNeeds: number;
    suggestedWants: number;
    suggestedSavings: number;
    trackedExpenses: number;
    recurringExpenses: number;
    upcomingExpenses: number;
    availableAfterTracked: number;
    goalsTargetTotal: number;
    goalsProgressTotal: number;
  };
  employerTimeline: string[];
}

function asCurrency(value: number, code: "GBP" | "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
  }).format(value);
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    apiFetch<DashboardOverview>(`/api/dashboard/overview?userId=${user.id}`).then((res) => {
      setLoading(false);
      if (!res.ok || !res.data) {
        setError(res.error?.message ?? "Could not load dashboard.");
        return;
      }
      setData(res.data);
    });
  }, [user?.id]);

  const currency = data?.user.currency ?? "GBP";

  const criticalChanges = useMemo(() => {
    return (data?.momDiff ?? []).filter((diff) => Math.abs(diff.delta) >= 50);
  }, [data?.momDiff]);

  const hasMonthlyData = (data?.monthlySeries ?? []).length > 0;

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      const next = Math.floor(node.getBoundingClientRect().width);
      setChartWidth(next > 0 ? next : 0);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, [hasMonthlyData]);

  if (authLoading) {
    return <Text>Loading your workspace...</Text>;
  }

  return (
    <PageShell
      title="Dashboard"
      subtitle="Track budget health, payroll trends, and month-over-month deduction changes from one workspace."
    >
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {loading ? <Text>Refreshing your latest payroll analytics...</Text> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Current Net (Confirmed)</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">
            {asCurrency(data?.latestBreakdown?.net ?? 0, currency)}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Current Tax</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">
            {asCurrency(data?.latestBreakdown?.tax ?? 0, currency)}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Planned Savings</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">
            {asCurrency(data?.budgetSnapshot.suggestedSavings ?? 0, currency)}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Usage Meter</Text>
          <p className="mt-2 text-2xl/8 font-semibold text-zinc-950 dark:text-white">
            {data?.usage
              ? data.usage.unlimitedPayslips
                ? `Unlimited (${data.usage.plan})`
                : `${data.usage.freePayslipsUsed}/${data.usage.freePayslipsLimit} free payslips used`
              : "n/a"}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Subheading>Monthly Payslip Breakdown</Subheading>
            <Badge color="blue">Stacked trend</Badge>
          </div>
          {!hasMonthlyData ? (
            <Text>Confirm at least one payslip to render your stacked payroll graph.</Text>
          ) : (
            <div ref={chartContainerRef} className="h-80 min-h-80 w-full">
              {chartWidth > 0 ? (
                <BarChart width={chartWidth} height={320} data={data?.monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => {
                      const candidate = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
                      return asCurrency(Number.isFinite(candidate) ? candidate : 0, currency);
                    }}
                    contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7" }}
                  />
                  <Legend />
                  <Bar dataKey="gross" stackId="payroll" fill="#0ea5e9" name="Gross" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="tax" stackId="payroll" fill="#f97316" name="Tax" />
                  <Bar dataKey="pension" stackId="payroll" fill="#22c55e" name="Pension" />
                </BarChart>
              ) : null}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Budget Snapshot</Subheading>
          <ul className="mt-4 space-y-3 text-sm/6">
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Monthly income (avg)</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.monthlyIncome ?? 0, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Suggested essentials</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.suggestedNeeds ?? 0, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Suggested lifestyle</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.suggestedWants ?? 0, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Tracked expenses</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.trackedExpenses ?? 0, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Available after tracked</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.availableAfterTracked ?? 0, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span>Goals progress</span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {asCurrency(data?.budgetSnapshot.goalsProgressTotal ?? 0, currency)} /{" "}
                {asCurrency(data?.budgetSnapshot.goalsTargetTotal ?? 0, currency)}
              </span>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>MoM Change Highlights</Subheading>
          {(data?.momDiff ?? []).length === 0 ? (
            <Text className="mt-3">Upload two confirmed payslips to generate change insights.</Text>
          ) : criticalChanges.length === 0 ? (
            <Text className="mt-3">No major MoM changes detected in the latest confirmed period.</Text>
          ) : (
            <ul className="mt-4 space-y-3">
              {criticalChanges.map((item) => (
                <li key={item.metric} className="rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
                  <p className="text-sm/6 font-medium text-zinc-950 capitalize dark:text-white">{item.metric}</p>
                  <Text className="mt-1">{item.insight}</Text>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Line Item Changes</Subheading>
          {(data?.lineItemChanges ?? []).length === 0 ? (
            <Text className="mt-3">No line-item deltas yet.</Text>
          ) : (
            <ul className="mt-4 space-y-3">
              {data?.lineItemChanges.slice(0, 6).map((item) => (
                <li key={`${item.type}-${item.label}`} className="rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm/6 font-medium text-zinc-950 dark:text-white">{item.label}</p>
                    <p className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{item.delta.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.isNew ? <Badge color="blue">New item</Badge> : null}
                    {item.isIrregular ? <Badge color="amber">Irregular</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Subheading>Employer Timeline</Subheading>
        {(data?.employerTimeline ?? []).length === 0 ? (
          <Text className="mt-3">No confirmed payslips yet.</Text>
        ) : (
          <ul className="mt-4 space-y-2">
            {data?.employerTimeline.map((entry) => (
              <li key={entry} className="text-sm/6 text-zinc-700 dark:text-zinc-300">
                {entry}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
