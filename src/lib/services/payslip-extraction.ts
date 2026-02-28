import { z } from "zod";
import { parsedPayslipSchema } from "@/lib/validation/schemas";
import type { ParsedPayslip, Region } from "@/lib/types/domain";

interface ExtractionOutput {
  parsed: ParsedPayslip;
  confidence: number;
  notes: string | null;
}

const requiredBySchema: Record<string, Array<keyof ParsedPayslip>> = {
  UK_v1: ["gross", "net", "tax", "pension", "niOrPrsi", "periodMonth", "periodYear", "employerName"],
  IE_v1: ["gross", "net", "tax", "pension", "niOrPrsi", "usc", "periodMonth", "periodYear", "employerName"]
};

const modelResponseSchema = z.object({
  parsed: parsedPayslipSchema,
  confidence: z.number().min(0).max(1).default(0.7),
  notes: z.string().nullable().optional()
});

function schemaForRegion(region: Region): string {
  return region === "UK" ? "UK_v1" : "IE_v1";
}

function defaultPayload(region: Region): ParsedPayslip {
  const schemaVersion = schemaForRegion(region);
  const common = {
    schemaVersion,
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    employerName: "Unknown Employer",
    gross: 3000,
    net: 2300,
    tax: 420,
    pension: 120,
    niOrPrsi: 160,
    bonuses: 0,
    overtime: 0,
    lineItems: [
      { type: "EARNING" as const, label: "Base Salary", amount: 3000, confidence: 0.95 },
      { type: "TAX" as const, label: "PAYE", amount: 420, confidence: 0.91 },
      { type: "DEDUCTION" as const, label: "Pension", amount: 120, confidence: 0.89 }
    ],
    fieldConfidence: {
      periodMonth: 0.95,
      periodYear: 0.95,
      employerName: 0.84,
      gross: 0.96,
      net: 0.95,
      tax: 0.93,
      pension: 0.9,
      niOrPrsi: 0.88
    },
    validationErrors: [] as string[],
    editedFields: {
      periodMonth: false,
      periodYear: false,
      employerName: false,
      gross: false,
      net: false,
      tax: false,
      pension: false,
      niOrPrsi: false,
      usc: false,
      bonuses: false,
      overtime: false
    }
  };

  if (region === "IE") {
    return {
      ...common,
      usc: 65,
      lineItems: [
        ...common.lineItems,
        { type: "DEDUCTION", label: "USC", amount: 65, confidence: 0.9 }
      ],
      fieldConfidence: {
        ...common.fieldConfidence,
        usc: 0.9
      }
    };
  }

  return {
    ...common,
    usc: 0
  };
}

export function validateParsedPayslip(parsed: ParsedPayslip): string[] {
  const required = requiredBySchema[parsed.schemaVersion] ?? requiredBySchema.UK_v1;
  const errors: string[] = [];

  required.forEach((field) => {
    const value = parsed[field];
    const missing = value === null || value === undefined || value === "";
    if (missing) {
      errors.push(`${field} is required for ${parsed.schemaVersion}.`);
      return;
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      errors.push(`${field} must be a valid number.`);
    }
  });

  if (parsed.net > parsed.gross) {
    errors.push("net cannot exceed gross.");
  }

  return errors;
}

export async function extractPayslip(
  input: { filePath: string; mimeType: string; region: Region },
  manualRawJson?: unknown
): Promise<ExtractionOutput> {
  const simulatedPayload =
    manualRawJson ??
    ({
      parsed: defaultPayload(input.region),
      confidence: 0.86,
      notes: `Extraction simulated for ${input.mimeType} from ${input.filePath}.`
    } satisfies ExtractionOutput);

  const result = modelResponseSchema.safeParse(simulatedPayload);
  if (!result.success) {
    throw new Error(`Failed to parse extraction payload: ${result.error.message}`);
  }

  const requiredErrors = validateParsedPayslip(result.data.parsed);
  const parsed: ParsedPayslip = {
    ...result.data.parsed,
    validationErrors: [...result.data.parsed.validationErrors, ...requiredErrors]
  };

  return {
    parsed,
    confidence: result.data.confidence,
    notes: result.data.notes ?? null
  };
}
