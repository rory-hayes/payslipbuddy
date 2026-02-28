"use client";

import { ChartBarIcon, CreditCardIcon, HomeIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
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
    onboardingCompleted: boolean;
    budgetSetupCompleted: boolean;
    monthlyIncomeTarget: number | null;
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
  budgetCategories: Array<{
    category: string;
    accent: "blue" | "amber" | "orange" | "fuchsia" | "zinc";
    spent: number;
    budget: number;
    spentPercent: number;
  }>;
  spendingStatus: {
    label: "GOOD" | "WATCH" | "HIGH";
    percent: number;
  };
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    progressAmount: number;
    targetDate: string | null;
    progressPercent: number;
  }>;
  employerTimeline: string[];
}

function asCurrency(value: number, code: "GBP" | "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
  }).format(value);
}

function periodLabel(period: DashboardOverview["latestPayslip"]) {
  if (!period) {
    return "Awaiting your first confirmed payslip";
  }
  return `Latest period: ${String(period.periodMonth).padStart(2, "0")}/${period.periodYear}`;
}

const categoryStyles: Record<
  DashboardOverview["budgetCategories"][number]["accent"],
  { text: string; progress: string; chip: "blue" | "amber" | "orange" | "fuchsia" | "zinc" }
> = {
  blue: { text: "text-blue-700", progress: "bg-blue-500", chip: "blue" },
  amber: { text: "text-amber-700", progress: "bg-amber-500", chip: "amber" },
  orange: { text: "text-orange-700", progress: "bg-orange-500", chip: "orange" },
  fuchsia: { text: "text-fuchsia-700", progress: "bg-fuchsia-500", chip: "fuchsia" },
  zinc: { text: "text-zinc-700", progress: "bg-zinc-500", chip: "zinc" }
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestVersionRef = useRef(0);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError("");
    apiFetch<DashboardOverview>(`/api/dashboard/overview?userId=${user.id}`).then((res) => {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setLoading(false);
      setHasLoaded(true);
      if (!res.ok || !res.data) {
        setError(res.error?.message ?? "Could not load dashboard.");
        return;
      }
      setError("");
      setData(res.data);
    });
  }, [user?.id]);

  const currency = data?.user.currency ?? "GBP";
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

  const criticalChanges = useMemo(() => {
    return (data?.momDiff ?? []).filter((diff) => Math.abs(diff.delta) >= 50).slice(0, 4);
  }, [data?.momDiff]);

  if (authLoading) {
    return <Text>Loading your workspace...</Text>;
  }

  if (!hasLoaded && loading) {
    return <Text>Loading dashboard analytics...</Text>;
  }

  const income = data?.budgetSnapshot.monthlyIncome ?? 0;
  const expenses = data?.budgetSnapshot.trackedExpenses ?? 0;
  const balance = data?.budgetSnapshot.availableAfterTracked ?? 0;
  const spendingPercent = data?.spendingStatus.percent ?? 0;
  const needsBudgetSetup = Boolean(data && !data.user.budgetSetupCompleted);
  const budgetSetupHref = data?.user.onboardingCompleted ? "/budget" : "/onboarding?step=budget";

  return (
    <PageShell
      title="Personal Budget Tracker"
      subtitle="Track monthly payroll, spending, and savings targets from one unified payslip-first dashboard."
      actions={<Badge color="blue">{periodLabel(data?.latestPayslip ?? null)}</Badge>}
    >
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      ) : null}

      {loading ? <Text>Refreshing your latest budget analytics...</Text> : null}

      {needsBudgetSetup ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm/6 font-semibold text-amber-900">Complete budget setup</p>
              <p className="text-sm/6 text-amber-800">
                Add recurring expenses and at least one goal so your monthly budget board and savings progress stay accurate.
              </p>
            </div>
            <Button href={budgetSetupHref}>Complete budget setup</Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 p-6 text-white shadow-lg shadow-blue-500/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs/5 uppercase tracking-[0.2em] text-blue-100">Budget Health</p>
            <h2 className="text-2xl/8 font-semibold">Build confidence in your monthly money decisions.</h2>
            <p className="text-sm/6 text-blue-100">
              Plan: {data?.user.plan ?? "FREE"} · Region: {data?.user.region ?? "UK"} · Currency: {currency}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur">
              <p className="text-xs/5 uppercase tracking-wide text-blue-100">Suggested Savings</p>
              <p className="mt-1 text-xl/7 font-semibold">
                {asCurrency(data?.budgetSnapshot.suggestedSavings ?? 0, currency)}
              </p>
            </article>
            <article className="rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur">
              <p className="text-xs/5 uppercase tracking-wide text-blue-100">Spending Ratio</p>
              <p className="mt-1 text-xl/7 font-semibold">{spendingPercent.toFixed(1)}%</p>
            </article>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button href="/dashboard">Dashboard</Button>
        <Button href="/payslips" outline>
          Transactions
        </Button>
        <Button href="/budget" outline>
          Budgets
        </Button>
        <Button href="/reports" outline>
          Savings
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Text>Total Income</Text>
            <ChartBarIcon className="size-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl/9 font-semibold text-emerald-600">{asCurrency(income, currency)}</p>
          <Text className="mt-2">Net monthly income from confirmed payslips.</Text>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Text>Total Expenses</Text>
            <CreditCardIcon className="size-5 text-rose-600" />
          </div>
          <p className="mt-2 text-3xl/9 font-semibold text-rose-600">{asCurrency(expenses, currency)}</p>
          <Text className="mt-2">Tracked recurring, upcoming, and one-off expenses.</Text>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Text>Current Balance</Text>
            <HomeIcon className="size-5 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl/9 font-semibold text-blue-600">{asCurrency(balance, currency)}</p>
          <Text className="mt-2">Income remaining after currently tracked outgoings.</Text>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Text>Spending Status</Text>
            <SparklesIcon className="size-5 text-emerald-600" />
          </div>
          <p
            className={`mt-2 text-3xl/9 font-semibold ${
              data?.spendingStatus.label === "GOOD"
                ? "text-emerald-600"
                : data?.spendingStatus.label === "WATCH"
                  ? "text-amber-600"
                  : "text-rose-600"
            }`}
          >
            {data?.spendingStatus.label ?? "GOOD"}
          </p>
          <Text className="mt-2">{spendingPercent.toFixed(1)}% of monthly income currently allocated.</Text>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Subheading>Budget Overview</Subheading>
            <Badge color="blue">Planned vs Spent</Badge>
          </div>

          <div className="space-y-5">
            {(data?.budgetCategories ?? []).map((item) => {
              const style = categoryStyles[item.accent] ?? categoryStyles.zinc;
              return (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm/6 font-semibold ${style.text}`}>{item.category}</p>
                    <p className="text-sm/6 text-zinc-600">
                      {asCurrency(item.spent, currency)} / {asCurrency(item.budget, currency)}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${style.progress}`}
                      style={{ width: `${Math.min(100, Math.max(0, item.spentPercent))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Subheading>Savings Goals</Subheading>
            <Badge color="fuchsia">Targets</Badge>
          </div>

          {(data?.goals ?? []).length === 0 ? (
            <Text>No goals set yet. Add your first goal from the budget board.</Text>
          ) : (
            <div className="space-y-5">
              {(data?.goals ?? []).map((goal) => (
                <div key={goal.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm/6 font-semibold text-zinc-950">{goal.name}</p>
                    <p className="text-sm/6 font-semibold text-fuchsia-600">{goal.progressPercent.toFixed(1)}% complete</p>
                  </div>
                  <p className="mt-1 text-sm/6 text-zinc-600">
                    {asCurrency(goal.progressAmount, currency)} saved of {asCurrency(goal.targetAmount, currency)}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-fuchsia-100">
                    <div
                      className="h-full rounded-full bg-fuchsia-500"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progressPercent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Subheading>Payslip Trend</Subheading>
            <Badge color="blue">Stacked by month</Badge>
          </div>
          {!hasMonthlyData ? (
            <Text>Confirm at least one payslip to render monthly stacked trend charts.</Text>
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
                  <Bar dataKey="gross" stackId="payroll" fill="#2563eb" name="Gross" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="tax" stackId="payroll" fill="#f97316" name="Tax" />
                  <Bar dataKey="pension" stackId="payroll" fill="#14b8a6" name="Pension" />
                </BarChart>
              ) : null}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>What Changed</Subheading>
          {criticalChanges.length === 0 ? (
            <Text className="mt-3">No major month-over-month payroll changes detected yet.</Text>
          ) : (
            <ul className="mt-4 space-y-3">
              {criticalChanges.map((item) => (
                <li key={item.metric} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm/6 font-semibold capitalize text-zinc-950">{item.metric}</p>
                  <Text className="mt-1">{item.insight}</Text>
                </li>
              ))}
            </ul>
          )}

          {(data?.lineItemChanges ?? []).length > 0 ? (
            <div className="mt-5">
              <Text className="font-medium">Irregular line items</Text>
              <ul className="mt-2 space-y-2">
                {(data?.lineItemChanges ?? [])
                  .filter((item) => item.isNew || item.isIrregular)
                  .slice(0, 3)
                  .map((item) => (
                    <li key={`${item.type}-${item.label}`} className="flex items-center justify-between text-sm/6 text-zinc-700">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.delta.toFixed(2)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Subheading>Employer Timeline</Subheading>
          {data?.usage ? (
            <Badge color={data.usage.unlimitedPayslips ? "emerald" : "blue"}>
              {data.usage.unlimitedPayslips
                ? `${data.usage.plan} unlimited`
                : `${data.usage.freePayslipsUsed}/${data.usage.freePayslipsLimit} used`}
            </Badge>
          ) : null}
        </div>
        {(data?.employerTimeline ?? []).length === 0 ? (
          <Text>No confirmed payslips yet.</Text>
        ) : (
          <ul className="space-y-2">
            {data?.employerTimeline.map((entry) => (
              <li key={entry} className="text-sm/6 text-zinc-700">
                {entry}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
