"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { DEMO_USER_ID } from "@/lib/constants";
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
  const [error, setError] = useState<string>("");

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
      subtitle="Track net pay, deductions, month-over-month changes, and employer timeline from one view."
    >
      {error ? <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Net (Confirmed)</p>
          <p className="metric-value mt-2 text-2xl text-ink">
            {asCurrency(data?.latestBreakdown?.net ?? 0, currency)}
          </p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Tax</p>
          <p className="metric-value mt-2 text-2xl text-ink">
            {asCurrency(data?.latestBreakdown?.tax ?? 0, currency)}
          </p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Usage Meter</p>
          <p className="metric-value mt-2 text-xl text-ink">
            {data?.usage
              ? data.usage.unlimitedPayslips
                ? `Unlimited (${data.usage.plan})`
                : `${data.usage.freePayslipsUsed}/${data.usage.freePayslipsLimit} free payslips used`
              : "n/a"}
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">MoM Change Highlights</h2>
          {(data?.momDiff ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Upload two confirmed payslips to generate change insights.</p>
          ) : criticalChanges.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No major MoM changes detected in the latest confirmed period.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {criticalChanges.map((item) => (
                <li key={item.metric} className="rounded-lg bg-slate-50 px-3 py-2">
                  <strong className="capitalize">{item.metric}</strong>: {item.insight}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Line Item Changes</h2>
          {(data?.lineItemChanges ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No line-item deltas yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              {data?.lineItemChanges.slice(0, 6).map((item) => (
                <li key={`${item.type}-${item.label}`}>
                  <div className="flex items-center justify-between">
                    <span>
                      {item.label} {item.isNew ? "(new)" : ""}
                    </span>
                    <span>{item.delta.toFixed(2)}</span>
                  </div>
                  {item.isIrregular ? <p className="mt-1 text-xs text-amber-700">Irregular change detected</p> : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold text-ink">Employer Timeline</h2>
        {(data?.employerTimeline ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No confirmed payslips yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {data?.employerTimeline.map((entry) => <li key={entry}>{entry}</li>)}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
