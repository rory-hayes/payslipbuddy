import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { annualReportToPdf, annualReportToWorkbook, buildAnnualReport } from "@/lib/services/reporting";

beforeEach(() => {
  // @ts-expect-error test-only global reset
  global.__PAYSLIP_BUDDY_STATE__ = undefined;
});

describe("annual reporting", () => {
  it("creates required xlsx tabs", async () => {
    const file = inMemoryDb.addFile({
      userId: "user_demo",
      bucket: "payslips",
      path: "demo.pdf",
      mimeType: "application/pdf"
    });

    const payslip = inMemoryDb.addPayslip({
      userId: "user_demo",
      employerId: "emp_demo",
      sourceFileId: file.id,
      periodMonth: 1,
      periodYear: 2026,
      schemaVersion: "UK_v1"
    });

    inMemoryDb.saveBreakdown(payslip.id, {
      schemaVersion: "UK_v1",
      periodMonth: 1,
      periodYear: 2026,
      employerName: "Example Ltd",
      gross: 3000,
      net: 2300,
      tax: 420,
      pension: 120,
      niOrPrsi: 160,
      usc: 0,
      bonuses: 0,
      overtime: 0,
      lineItems: [{ type: "TAX", label: "PAYE", amount: 420 }],
      fieldConfidence: {},
      validationErrors: [],
      editedFields: {}
    });
    inMemoryDb.setPayslipConfirmed(payslip.id);

    const report = buildAnnualReport("user_demo", 2026);
    const workbookBuffer = await annualReportToWorkbook(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Payslips",
      "LineItems",
      "MonthlySummary",
      "Employers"
    ]);
  });

  it("generates a valid pdf header", () => {
    const report = buildAnnualReport("user_demo", 2026);
    const pdf = annualReportToPdf(report);
    expect(pdf.toString("utf8", 0, 8)).toContain("%PDF-1.4");
  });
});
