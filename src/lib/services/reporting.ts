import { format } from "date-fns";
import ExcelJS from "exceljs";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import type { AnnualReport, MonthlySeriesPoint, PayslipLineItemType } from "@/lib/types/domain";

function getMonthStamp(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), "yyyy-MM");
}

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function buildAnnualReport(userId: string, year: number): AnnualReport {
  const payslips = inMemoryDb
    .listPayslipsByUser(userId)
    .filter((payslip) => payslip.status === "CONFIRMED" && payslip.periodYear === year)
    .sort((a, b) => (a.periodMonth > b.periodMonth ? 1 : -1));

  const monthlySeries: MonthlySeriesPoint[] = payslips
    .map((payslip) => {
      const breakdown = inMemoryDb.getBreakdown(payslip.id);
      if (!breakdown) {
        return null;
      }

      return {
        month: getMonthStamp(payslip.periodYear, payslip.periodMonth),
        gross: breakdown.gross,
        net: breakdown.net,
        tax: breakdown.tax,
        pension: breakdown.pension,
        niOrPrsi: breakdown.niOrPrsi,
        usc: breakdown.usc ?? 0
      };
    })
    .filter((item): item is MonthlySeriesPoint => item !== null)
    .sort((a, b) => a.month.localeCompare(b.month));

  const totals = monthlySeries.reduce(
    (acc, row) => {
      acc.gross += safeNumber(row.gross);
      acc.net += safeNumber(row.net);
      acc.tax += safeNumber(row.tax);
      acc.pension += safeNumber(row.pension);
      return acc;
    },
    { gross: 0, net: 0, tax: 0, pension: 0, niOrPrsi: 0, usc: 0 }
  );

  totals.niOrPrsi = payslips
    .map((payslip) => safeNumber(inMemoryDb.getBreakdown(payslip.id)?.niOrPrsi))
    .reduce((sum, value) => sum + value, 0);
  totals.usc = payslips
    .map((payslip) => safeNumber(inMemoryDb.getBreakdown(payslip.id)?.usc))
    .reduce((sum, value) => sum + value, 0);

  const employerTimeline = Array.from(
    payslips.reduce(
      (map, payslip) => {
        const employer = inMemoryDb.getEmployer(payslip.employerId);
        const existing = map.get(payslip.employerId) ?? {
          employerId: payslip.employerId,
          employerName: employer?.name ?? "Unknown Employer",
          months: [] as string[]
        };

        existing.months.push(getMonthStamp(payslip.periodYear, payslip.periodMonth));
        map.set(payslip.employerId, existing);
        return map;
      },
      new Map<string, { employerId: string; employerName: string; months: string[] }>()
    ).values()
  ).map((entry) => ({
    ...entry,
    months: Array.from(new Set(entry.months)).sort()
  }));

  const lineItemMap = new Map<string, {
    type: PayslipLineItemType;
    label: string;
    total: number;
    occurrences: number;
    firstSeenMonth: number;
    irregular: boolean;
  }>();

  payslips.forEach((payslip) => {
    const month = payslip.periodMonth;
    const items = inMemoryDb.listLineItemsByPayslip(payslip.id);

    items.forEach((item) => {
      const key = `${item.type}:${item.label}`;
      const existing = lineItemMap.get(key) ?? {
        type: item.type,
        label: item.label,
        total: 0,
        occurrences: 0,
        firstSeenMonth: month,
        irregular: false
      };

      existing.total += item.amount;
      existing.occurrences += 1;
      existing.firstSeenMonth = Math.min(existing.firstSeenMonth, month);
      if (Math.abs(item.amount) >= 100) {
        existing.irregular = true;
      }

      lineItemMap.set(key, existing);
    });
  });

  const latestMonth = payslips.length > 0 ? Math.max(...payslips.map((entry) => entry.periodMonth)) : 0;

  const lineItemTotals = Array.from(lineItemMap.values())
    .map((item) => ({
      type: item.type,
      label: item.label,
      total: Number(item.total.toFixed(2)),
      occurrences: item.occurrences,
      irregular: item.irregular,
      isNewThisYear: item.occurrences === 1 && item.firstSeenMonth === latestMonth
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const confidences = payslips
    .map((payslip) => payslip.confidence)
    .filter((value): value is number => typeof value === "number");
  const averageConfidence =
    confidences.length > 0 ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0;

  const missingMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (month) => !payslips.some((payslip) => payslip.periodMonth === month)
  );

  const userEditedFieldCount = payslips
    .map((payslip) => inMemoryDb.getBreakdown(payslip.id)?.editedFields ?? {})
    .map((fields) => Object.values(fields).filter(Boolean).length)
    .reduce((sum, count) => sum + count, 0);

  const report: AnnualReport = {
    userId,
    year,
    totals,
    monthlySeries,
    employerTimeline,
    lineItemTotals,
    dataQuality: {
      averageConfidence: Number((averageConfidence * 100).toFixed(1)),
      missingMonths,
      userEditedFieldCount
    },
    taxBackSummary: [],
    exportPdfUrl: null,
    exportXlsxUrl: null
  };

  return inMemoryDb.saveAnnualReport(report);
}

export async function annualReportToWorkbook(report: AnnualReport): Promise<Buffer> {
  const payslips = inMemoryDb
    .listPayslipsByUser(report.userId)
    .filter((entry) => entry.status === "CONFIRMED" && entry.periodYear === report.year)
    .sort((a, b) => (a.periodMonth > b.periodMonth ? 1 : -1));

  const payslipRows = payslips.map((payslip) => {
    const breakdown = inMemoryDb.getBreakdown(payslip.id);
    const employer = inMemoryDb.getEmployer(payslip.employerId);
    return {
      payslip_id: payslip.id,
      month: getMonthStamp(payslip.periodYear, payslip.periodMonth),
      employer_name: employer?.name ?? "Unknown Employer",
      gross: breakdown?.gross ?? 0,
      net: breakdown?.net ?? 0,
      tax: breakdown?.tax ?? 0,
      pension: breakdown?.pension ?? 0,
      ni_or_prsi: breakdown?.niOrPrsi ?? 0,
      usc: breakdown?.usc ?? 0
    };
  });

  const lineItemRows = payslips.flatMap((payslip) => {
    const month = getMonthStamp(payslip.periodYear, payslip.periodMonth);
    return inMemoryDb.listLineItemsByPayslip(payslip.id).map((item) => ({
      payslip_id: payslip.id,
      month,
      type: item.type,
      label: item.label,
      amount: item.amount
    }));
  });

  const monthlyRows = report.monthlySeries.map((row) => ({
    month: row.month,
    gross: row.gross,
    net: row.net,
    tax: row.tax,
    pension: row.pension,
    ni_or_prsi: row.niOrPrsi,
    usc: row.usc
  }));

  const employerRows = report.employerTimeline.map((item) => ({
    employer_id: item.employerId,
    employer_name: item.employerName,
    months: item.months.join(", ")
  }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PaySlip Buddy";
  workbook.created = new Date();

  addWorksheet(workbook, "Payslips", payslipRows);
  addWorksheet(workbook, "LineItems", lineItemRows);
  addWorksheet(workbook, "MonthlySummary", monthlyRows);
  addWorksheet(workbook, "Employers", employerRows);

  const fileBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(fileBuffer);
}

function addWorksheet(workbook: ExcelJS.Workbook, name: string, rows: Record<string, string | number>[]) {
  const sheet = workbook.addWorksheet(name);
  const columns = Object.keys(rows[0] ?? {}).map((key) => ({
    header: key,
    key,
    width: Math.max(12, key.length + 4)
  }));

  sheet.columns = columns;
  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export function annualReportToPdf(report: AnnualReport): Buffer {
  const swingMonths = report.monthlySeries
    .map((row, index, rows) => {
      const previous = rows[index - 1];
      if (!previous) {
        return null;
      }
      const delta = row.net - previous.net;
      if (Math.abs(delta) < 200) {
        return null;
      }
      return `${row.month} (net delta ${delta.toFixed(2)})`;
    })
    .filter((item): item is string => item !== null);

  const pageOne = [
    "Annual Income & Deductions Report",
    `Year: ${report.year}`,
    "",
    "Page 1 - Summary",
    `Total gross pay (YTD): ${report.totals.gross.toFixed(2)}`,
    `Total net pay (YTD): ${report.totals.net.toFixed(2)}`,
    `Total tax paid (PAYE): ${report.totals.tax.toFixed(2)}`,
    `Total NI/PRSI: ${report.totals.niOrPrsi.toFixed(2)}`,
    `Total USC: ${report.totals.usc.toFixed(2)}`,
    `Total pension: ${report.totals.pension.toFixed(2)}`,
    "",
    "Employers:",
    ...report.employerTimeline.map((entry) => `- ${entry.employerName}: ${entry.months.join(", ")}`)
  ];

  const pageTwo = [
    "Page 2 - Monthly Series",
    "month | gross | net | tax | pension | NI/PRSI | USC",
    ...report.monthlySeries.map(
      (row) =>
        `${row.month} | ${row.gross.toFixed(2)} | ${row.net.toFixed(2)} | ${row.tax.toFixed(2)} | ${row.pension.toFixed(
          2
        )} | ${row.niOrPrsi.toFixed(2)} | ${row.usc.toFixed(2)}`
    ),
    "",
    `Major swings: ${swingMonths.length > 0 ? swingMonths.join("; ") : "none"}`
  ];

  const pageThree = [
    "Page 3 - Deductions & Line Items",
    "type | label | total | irregular | new",
    ...report.lineItemTotals.map(
      (item) =>
        `${item.type} | ${item.label} | ${item.total.toFixed(2)} | ${item.irregular ? "yes" : "no"} | ${
          item.isNewThisYear ? "yes" : "no"
        }`
    )
  ];

  const pageFour = [
    "Page 4 - Notes & Data Quality",
    `Average extraction confidence: ${report.dataQuality.averageConfidence}%`,
    `Missing months: ${report.dataQuality.missingMonths.length > 0 ? report.dataQuality.missingMonths.join(", ") : "none"}`,
    `User overrides captured: ${report.dataQuality.userEditedFieldCount}`
  ];

  return buildSimplePdf([pageOne, pageTwo, pageThree, pageFour]);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(pages: string[][]): Buffer {
  const preparedPages = pages
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.slice(0, 45).map((line) => escapePdfText(line)));

  if (preparedPages.length === 0) {
    preparedPages.push(["Annual report is unavailable."]);
  }

  const pageObjectIds = preparedPages.map((_, index) => 3 + index * 2);
  const contentObjectIds = preparedPages.map((_, index) => 4 + index * 2);
  const fontObjectId = 3 + preparedPages.length * 2;

  const objects: string[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push(
    `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${preparedPages.length} >> endobj`
  );

  preparedPages.forEach((lines, index) => {
    const textCommands = lines.map((line) => `(${line}) Tj`).join(" T* ");
    const contentStream = `BT /F1 10 Tf 40 790 Td 12 TL ${textCommands} ET`;

    objects.push(
      `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectIds[index]} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> >> endobj`
    );
    objects.push(
      `${contentObjectIds[index]} 0 obj << /Length ${Buffer.byteLength(contentStream, "utf8")} >> stream\n${contentStream}\nendstream endobj`
    );
  });

  objects.push(`${fontObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);

  let offset = "%PDF-1.4\n".length;
  const offsets = [0];
  const body = objects
    .map((obj) => {
      offsets.push(offset);
      offset += Buffer.byteLength(obj, "utf8") + 1;
      return `${obj}\n`;
    })
    .join("");

  const xrefStart = offset;
  const xrefEntries = offsets
    .map((entryOffset, index) =>
      index === 0 ? "0000000000 65535 f " : `${entryOffset.toString().padStart(10, "0")} 00000 n `
    )
    .join("\n");

  const pdf = `%PDF-1.4\n${body}xref\n0 ${offsets.length}\n${xrefEntries}\ntrailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
