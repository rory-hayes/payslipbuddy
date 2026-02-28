"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";
import { DEMO_USER_ID } from "@/lib/constants";
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
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<DashboardOverview>(`/api/dashboard/overview?userId=${DEMO_USER_ID}`).then((res) => {
      if (!res.ok || !res.data) {
        setError(res.error?.message ?? "Could not load dashboard.");
        return;
      }
      setData(res.data);
    });
  }, []);

  const currency = data?.user.currency ?? "GBP";

  const criticalChanges = useMemo(() => {
    return (data?.momDiff ?? []).filter((diff) => Math.abs(diff.delta) >= 50);
  }, [data?.momDiff]);

  return (
    <PageShell
      title="Dashboard"
      subtitle="Track net pay, deductions, month-over-month changes, and employer timeline from one workspace."
    >
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
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
