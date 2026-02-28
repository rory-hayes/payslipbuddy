import { describe, expect, it } from "vitest";
import { calculateMomDiff, detectLineItemChanges } from "@/lib/services/mom";

describe("mom calculations", () => {
  it("computes deltas and direction correctly", () => {
    const diffs = calculateMomDiff(
      {
        payslipId: "a",
        gross: 3200,
        net: 2450,
        tax: 460,
        pension: 130,
        niOrPrsi: 160,
        usc: 0,
        bonuses: 0,
        overtime: 40,
        fieldConfidence: {},
        editedFields: {},
        validationErrors: [],
        createdAt: "2026-01-01"
      },
      {
        payslipId: "b",
        gross: 3000,
        net: 2300,
        tax: 420,
        pension: 120,
        niOrPrsi: 150,
        usc: 0,
        bonuses: 0,
        overtime: 0,
        fieldConfidence: {},
        editedFields: {},
        validationErrors: [],
        createdAt: "2025-12-01"
      }
    );

    const gross = diffs.find((item) => item.metric === "gross");
    expect(gross?.delta).toBe(200);
    expect(gross?.direction).toBe("UP");
  });

  it("detects new and irregular line items", () => {
    const changes = detectLineItemChanges(
      [
        { id: "1", payslipId: "a", type: "DEDUCTION", label: "USC", amount: 65 },
        { id: "2", payslipId: "a", type: "TAX", label: "PAYE", amount: 500 }
      ],
      [{ id: "3", payslipId: "b", type: "TAX", label: "PAYE", amount: 420 }]
    );

    const usc = changes.find((item) => item.label === "USC");
    const paye = changes.find((item) => item.label === "PAYE");

    expect(usc?.isNew).toBe(true);
    expect(paye?.isIrregular).toBe(true);
  });
});
