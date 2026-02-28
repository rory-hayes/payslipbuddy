"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Select } from "@/components/catalyst/select";
import { Subheading } from "@/components/catalyst/heading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
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
      subtitle="Build your Annual Income & Deductions artifact with month-by-month payroll visibility and export-ready outputs."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))} className="min-w-24">
            {[currentYear - 1, currentYear].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Button onClick={() => exportFile("pdf")} disabled={!canExportPdf} type="button">
            Export PDF
          </Button>
          <Button onClick={() => exportFile("xlsx")} disabled={!canExportXlsx} outline type="button">
            Export XLSX
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <Badge color={plan === "FREE" ? "zinc" : plan === "PLUS" ? "blue" : "emerald"}>Plan: {plan}</Badge>
        {!canExportPdf ? <Badge color="amber">Upgrade for PDF export</Badge> : null}
        {!canExportXlsx ? <Badge color="amber">Pro required for XLSX</Badge> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {busy ? <Text>Loading annual report...</Text> : null}

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <Text>Total Gross</Text>
              <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">{formatMoney(report.totals.gross, currency)}</p>
            </article>
            <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <Text>Total Net</Text>
              <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">{formatMoney(report.totals.net, currency)}</p>
            </article>
            <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <Text>Total Tax</Text>
              <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">{formatMoney(report.totals.tax, currency)}</p>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <Subheading>Employer Timeline</Subheading>
              {report.employerTimeline.length === 0 ? (
                <Text className="mt-3">No confirmed payslips found for this year.</Text>
              ) : (
                <ul className="mt-4 space-y-2">
                  {report.employerTimeline.map((row) => (
                    <li key={row.employerId} className="text-sm/6 text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium text-zinc-950 dark:text-white">{row.employerName}</span>: {row.months.join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <Subheading>Months With Major Swings</Subheading>
              {majorSwingMonths.length === 0 ? (
                <Text className="mt-3">No major swings detected.</Text>
              ) : (
                <ul className="mt-4 space-y-2">
                  {majorSwingMonths.map((row) => (
                    <li key={row.month} className="text-sm/6 text-zinc-700 dark:text-zinc-300">
                      {row.month} ({formatMoney(row.net, currency)})
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <Subheading>Monthly Series</Subheading>
            <Table className="mt-4 [--gutter:--spacing(4)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Month</TableHeader>
                  <TableHeader>Gross</TableHeader>
                  <TableHeader>Net</TableHeader>
                  <TableHeader>Tax</TableHeader>
                  <TableHeader>Pension</TableHeader>
                  <TableHeader>NI/PRSI</TableHeader>
                  <TableHeader>USC</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.monthlySeries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No monthly data available for this year.</TableCell>
                  </TableRow>
                ) : (
                  report.monthlySeries.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{row.month}</TableCell>
                      <TableCell>{formatMoney(row.gross, currency)}</TableCell>
                      <TableCell>{formatMoney(row.net, currency)}</TableCell>
                      <TableCell>{formatMoney(row.tax, currency)}</TableCell>
                      <TableCell>{formatMoney(row.pension, currency)}</TableCell>
                      <TableCell>{formatMoney(row.niOrPrsi, currency)}</TableCell>
                      <TableCell>{formatMoney(row.usc, currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <Subheading>Deductions and Line Items</Subheading>
            {report.lineItemTotals.length === 0 ? (
              <Text className="mt-3">No line items available for this year.</Text>
            ) : (
              <ul className="mt-4 space-y-2">
                {report.lineItemTotals.map((item) => (
                  <li key={`${item.type}-${item.label}`} className="text-sm/6 text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium text-zinc-950 dark:text-white">{item.type} {item.label}</span>: {formatMoney(item.total, currency)}
                    {item.irregular ? " (irregular)" : ""}
                    {item.isNewThisYear ? " (new)" : ""}
                  </li>
                ))}
              </ul>
            )}
            <Text className="mt-4">
              Data quality: {report.dataQuality.averageConfidence}% average confidence, {report.dataQuality.userEditedFieldCount} user overrides.
            </Text>
            {report.dataQuality.missingMonths.length > 0 ? (
              <Text className="mt-2 text-amber-700 dark:text-amber-300">
                Missing months warning: {report.dataQuality.missingMonths.join(", ")}
              </Text>
            ) : null}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
