import { inMemoryDb } from "@/lib/db/in-memory-db";
import { usageMeter } from "@/lib/services/entitlements";
import { calculateMomDiff, detectLineItemChanges } from "@/lib/services/mom";

export function getDashboardOverview(userId: string) {
  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return null;
  }

  const payslips = inMemoryDb
    .listPayslipsByUser(userId)
    .filter((item) => item.status === "CONFIRMED")
    .sort((a, b) => {
      const aStamp = `${a.periodYear}${String(a.periodMonth).padStart(2, "0")}`;
      const bStamp = `${b.periodYear}${String(b.periodMonth).padStart(2, "0")}`;
      return bStamp.localeCompare(aStamp);
    });

  const latest = payslips[0] ? inMemoryDb.getBreakdown(payslips[0].id) : null;
  const previous = payslips[1] ? inMemoryDb.getBreakdown(payslips[1].id) : null;

  return {
    user,
    usage: usageMeter(userId),
    latestPayslip: payslips[0] ?? null,
    latestBreakdown: latest,
    momDiff: latest && previous ? calculateMomDiff(latest, previous) : [],
    lineItemChanges:
      payslips[0] && payslips[1]
        ? detectLineItemChanges(
            inMemoryDb.listLineItemsByPayslip(payslips[0].id),
            inMemoryDb.listLineItemsByPayslip(payslips[1].id)
          )
        : [],
    employerTimeline: Array.from(
      new Set(
        payslips.map((entry) => {
          const employer = inMemoryDb.getEmployer(entry.employerId);
          return `${entry.periodYear}-${String(entry.periodMonth).padStart(2, "0")} · ${employer?.name ?? "Unknown Employer"}`;
        })
      )
    )
  };
}
