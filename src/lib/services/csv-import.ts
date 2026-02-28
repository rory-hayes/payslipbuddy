import Papa from "papaparse";
import type { BankTransaction } from "@/lib/types/domain";

export interface CsvMapping {
  date: string;
  description: string;
  amount: string;
}

export function parseBankCsv(csvText: string, mapping: CsvMapping): Omit<BankTransaction, "id" | "bankImportId" | "userId">[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Unable to parse CSV input.");
  }

  return parsed.data.map((row) => {
    const postedAt = row[mapping.date];
    const description = row[mapping.description];
    const rawAmount = row[mapping.amount];

    if (!postedAt || !description || !rawAmount) {
      throw new Error("CSV row is missing mapped columns.");
    }

    const amount = Number(String(rawAmount).replace(/,/g, "").trim());
    if (!Number.isFinite(amount)) {
      throw new Error(`Invalid amount value in CSV: ${rawAmount}`);
    }

    return {
      postedAt: new Date(postedAt).toISOString(),
      description,
      amount,
      category: null
    };
  });
}
