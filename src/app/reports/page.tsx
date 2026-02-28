"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/catalyst/button";
import { Select } from "@/components/catalyst/select";
import { apiFetch } from "@/lib/client-api";
import { DEMO_USER_ID } from "@/lib/constants";

interface AnnualReport {
  year: number;
  totals: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    niOrPrsi: number;
    usc: number;
  };
  monthlySeries: Array<{
    month: string;
    gross: number;
    net: number;
    tax: number;
    pension: number;
    niOrPrsi: number;
    usc: number;
  }>;
  employerTimeline: Array<{
    employerId: string;
    employerName: string;
    months: string[];
  }>;
  lineItemTotals: Array<{
    type: string;
    label: string;
    total: number;
    irregular: boolean;
    isNewThisYear: boolean;
  }>;
  dataQuality: {
    averageConfidence: number;
    missingMonths: number[];
    userEditedFieldCount: number;
  };
}

interface BillingSummary {
  user: {
    plan: "FREE" | "PLUS" | "PRO";
    region: "UK" | "IE";
  };
}

function formatMoney(value: number, currency: "GBP" | "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [report, setReport] = useState<AnnualReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<"FREE" | "PLUS" | "PRO">("FREE");
  const [currency, setCurrency] = useState<"GBP" | "EUR">("GBP");

  const canExportPdf = plan !== "FREE";
  const canExportXlsx = plan === "PRO";

  const load = useCallback(async () => {
    setBusy(true);
    setError("");

    const result = await apiFetch<AnnualReport>(`/api/reports/annual?userId=${DEMO_USER_ID}&year=${year}`);

    if (!result.ok || !result.data) {
      setError(result.error?.message ?? "Could not load annual report.");
      setReport(null);
      setBusy(false);
      return;
    }

    setReport(result.data);
    setBusy(false);
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiFetch<BillingSummary>(`/api/billing/summary?userId=${DEMO_USER_ID}`).then((result) => {
      if (result.ok && result.data) {
        setPlan(result.data.user.plan);
        setCurrency(result.data.user.region === "IE" ? "EUR" : "GBP");
      }
    });
  }, []);

  const majorSwingMonths = useMemo(() => {
    const rows = report?.monthlySeries ?? [];
    return rows.filter((row, index) => {
      const previous = rows[index - 1];
      if (!previous) {
        return false;
      }
      return Math.abs(row.net - previous.net) >= 200;
    });
  }, [report?.monthlySeries]);

  async function exportFile(format: "pdf" | "xlsx") {
    if (format === "pdf" && !canExportPdf) {
      setError("PDF export requires a paid plan.");
      return;
    }

    if (format === "xlsx" && !canExportXlsx) {
      setError("XLSX export is available on Pro only.");
      return;
    }

    const response = await fetch("/api/reports/annual/export", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        userId: DEMO_USER_ID,
        year,
        format
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? `Failed to export ${format}.`);
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annual-income-deductions-${year}.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <PageShell
      title="Annual Reports"
      subtitle="Premium annual dashboard and exports. Free plan can upload and review one payslip, paid plans unlock annual reporting outputs."
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="min-w-24"
          >
            {[currentYear - 1, currentYear].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Button
            onClick={() => exportFile("pdf")}
            disabled={!canExportPdf}
            tone="primary"
            type="button"
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export PDF
          </Button>
          <Button
            onClick={() => exportFile("xlsx")}
            disabled={!canExportXlsx}
            tone="secondary"
            type="button"
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export XLSX
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-slate-500">
        Plan: {plan}. PDF export requires paid plan; XLSX export requires Pro.
      </p>
      {error ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <p>{error}</p>
          <Link href="/billing" className="mt-2 inline-block font-semibold underline">
            Upgrade to paid plan
          </Link>
        </div>
      ) : null}

      {busy ? <p className="text-sm text-slate-600">Loading annual report...</p> : null}

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="card p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Gross</p>
              <p className="metric-value mt-2 text-2xl text-ink">{formatMoney(report.totals.gross, currency)}</p>
            </article>
            <article className="card p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Net</p>
              <p className="metric-value mt-2 text-2xl text-ink">{formatMoney(report.totals.net, currency)}</p>
            </article>
            <article className="card p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Tax</p>
              <p className="metric-value mt-2 text-2xl text-ink">{formatMoney(report.totals.tax, currency)}</p>
            </article>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="card p-5">
              <h2 className="text-lg font-semibold text-ink">Employer Timeline</h2>
              {report.employerTimeline.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No confirmed payslips found for this year.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {report.employerTimeline.map((row) => (
                    <li key={row.employerId}>
                      <strong>{row.employerName}</strong>: {row.months.join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="card p-5">
              <h2 className="text-lg font-semibold text-ink">Months With Major Swings</h2>
              {majorSwingMonths.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No major swings detected.</p>
              ) : (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {majorSwingMonths.map((row) => (
                    <li key={row.month}>{row.month} ({formatMoney(row.net, currency)})</li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="text-lg font-semibold text-ink">Monthly Series</h2>
            <div className="table-shell mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-2">Month</th>
                    <th className="py-2">Gross</th>
                    <th className="py-2">Net</th>
                    <th className="py-2">Tax</th>
                    <th className="py-2">Pension</th>
                    <th className="py-2">NI/PRSI</th>
                    <th className="py-2">USC</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthlySeries.length === 0 ? (
                    <tr className="border-b border-slate-100">
                      <td className="py-3 text-slate-500" colSpan={7}>
                        No monthly data available for this year.
                      </td>
                    </tr>
                  ) : (
                    report.monthlySeries.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100">
                        <td className="py-2">{row.month}</td>
                        <td className="py-2">{formatMoney(row.gross, currency)}</td>
                        <td className="py-2">{formatMoney(row.net, currency)}</td>
                        <td className="py-2">{formatMoney(row.tax, currency)}</td>
                        <td className="py-2">{formatMoney(row.pension, currency)}</td>
                        <td className="py-2">{formatMoney(row.niOrPrsi, currency)}</td>
                        <td className="py-2">{formatMoney(row.usc, currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="text-lg font-semibold text-ink">Deductions and Line Items</h2>
            {report.lineItemTotals.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No line items available for this year.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {report.lineItemTotals.map((item) => (
                  <li key={`${item.type}-${item.label}`}>
                    {item.type} {item.label}: {formatMoney(item.total, currency)}
                    {item.irregular ? " (irregular)" : ""}
                    {item.isNewThisYear ? " (new)" : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Data quality: {report.dataQuality.averageConfidence}% average confidence, {report.dataQuality.userEditedFieldCount} user overrides.
            </p>
            {report.dataQuality.missingMonths.length > 0 ? (
              <p className="mt-2 text-xs text-amber-700">
                Missing months warning: {report.dataQuality.missingMonths.join(", ")}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
