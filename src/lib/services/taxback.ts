import { inMemoryDb } from "@/lib/db/in-memory-db";
import type { TaxBackEstimate, UserProfile } from "@/lib/types/domain";

const estimateRangeByRegion: Record<UserProfile["region"], { minRate: number; maxRate: number }> = {
  UK: { minRate: 0.02, maxRate: 0.07 },
  IE: { minRate: 0.03, maxRate: 0.1 }
};

export function buildTaxBackPack(userId: string, annualNetIncome: number): TaxBackEstimate[] {
  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return [];
  }

  const pool = inMemoryDb.listTaxBackByRegion(user.region);
  const rates = estimateRangeByRegion[user.region];

  return pool.map((item, index) => {
    const baseline = annualNetIncome * (rates.minRate + index * 0.005);
    const upper = annualNetIncome * (rates.maxRate + index * 0.008);

    return {
      itemId: item.id,
      category: item.category,
      estimatedMin: Math.max(20, Math.round(baseline)),
      estimatedMax: Math.max(40, Math.round(upper)),
      steps: [
        "Confirm eligibility against official guidance.",
        "Gather receipts/documents for the claim period.",
        "Submit claim in the official portal.",
        "Track decision and keep records for audit."
      ],
      officialLink: item.officialLink
    };
  });
}
