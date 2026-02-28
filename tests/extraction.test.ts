import { describe, expect, it } from "vitest";
import { extractPayslip } from "@/lib/services/payslip-extraction";

describe("payslip extraction", () => {
  it("assigns schema version by region", async () => {
    const uk = await extractPayslip({ filePath: "demo.pdf", mimeType: "application/pdf", region: "UK" });
    const ie = await extractPayslip({ filePath: "demo.pdf", mimeType: "application/pdf", region: "IE" });

    expect(uk.parsed.schemaVersion).toBe("UK_v1");
    expect(ie.parsed.schemaVersion).toBe("IE_v1");
  });

  it("returns validation errors for invalid net/gross", async () => {
    const result = await extractPayslip(
      { filePath: "demo.pdf", mimeType: "application/pdf", region: "UK" },
      {
        parsed: {
          schemaVersion: "UK_v1",
          periodMonth: 1,
          periodYear: 2026,
          employerName: "ACME",
          gross: 1000,
          net: 1200,
          tax: 100,
          pension: 50,
          niOrPrsi: 40,
          usc: 0,
          bonuses: 0,
          overtime: 0,
          lineItems: [],
          fieldConfidence: {},
          validationErrors: [],
          editedFields: {}
        },
        confidence: 0.8
      }
    );

    expect(result.parsed.validationErrors.some((msg) => msg.includes("net cannot exceed gross"))).toBe(true);
  });
});
