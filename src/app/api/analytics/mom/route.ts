import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok } from "@/lib/http";
import { calculateMomDiff, detectLineItemChanges } from "@/lib/services/mom";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const confirmed = inMemoryDb
    .listPayslipsByUser(userId)
    .filter((payslip) => payslip.status === "CONFIRMED")
    .sort((a, b) => {
      const aStamp = `${a.periodYear}-${String(a.periodMonth).padStart(2, "0")}`;
      const bStamp = `${b.periodYear}-${String(b.periodMonth).padStart(2, "0")}`;
      return bStamp.localeCompare(aStamp);
    });

  if (confirmed.length < 2) {
    return notFound("Need at least two confirmed payslips for MoM diff.");
  }

  const latest = confirmed[0];
  const previous = confirmed[1];
  const latestBreakdown = inMemoryDb.getBreakdown(latest.id);
  const previousBreakdown = inMemoryDb.getBreakdown(previous.id);

  if (!latestBreakdown || !previousBreakdown) {
    return notFound("Missing payslip breakdown data.");
  }

  return ok({
    latest: {
      id: latest.id,
      periodMonth: latest.periodMonth,
      periodYear: latest.periodYear
    },
    previous: {
      id: previous.id,
      periodMonth: previous.periodMonth,
      periodYear: previous.periodYear
    },
    diffs: calculateMomDiff(latestBreakdown, previousBreakdown),
    lineItemChanges: detectLineItemChanges(
      inMemoryDb.listLineItemsByPayslip(latest.id),
      inMemoryDb.listLineItemsByPayslip(previous.id)
    )
  });
}
