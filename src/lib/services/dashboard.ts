import { inMemoryDb } from "@/lib/db/in-memory-db";
import { usageMeter } from "@/lib/services/entitlements";
import { calculateMomDiff, detectLineItemChanges } from "@/lib/services/mom";

export function getDashboardOverview(userId: string) {
  const user = inMemoryDb.ensureUser({ id: userId });

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
  const households = inMemoryDb.listHouseholdsByUser(userId);
  const primaryHousehold = households[0] ?? null;
  const expenses = primaryHousehold ? inMemoryDb.listExpensesByHousehold(primaryHousehold.id) : [];
  const goals = primaryHousehold ? inMemoryDb.listGoalsByHousehold(primaryHousehold.id) : [];

  const monthlySeries = payslips
    .map((payslip) => {
      const breakdown = inMemoryDb.getBreakdown(payslip.id);
      if (!breakdown) {
        return null;
      }

      return {
        month: `${payslip.periodYear}-${String(payslip.periodMonth).padStart(2, "0")}`,
        gross: breakdown.gross,
        net: breakdown.net,
        tax: breakdown.tax,
        pension: breakdown.pension,
        niOrPrsi: breakdown.niOrPrsi,
        usc: breakdown.usc ?? 0
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.month.localeCompare(b.month));

  const averageNet =
    monthlySeries.length === 0
      ? 0
      : monthlySeries.reduce((sum, row) => sum + row.net, 0) / Math.max(monthlySeries.length, 1);

  const trackedExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recurringExpenses = expenses
    .filter((expense) => expense.kind === "RECURRING")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const upcomingExpenses = expenses
    .filter((expense) => expense.kind === "UPCOMING")
    .reduce((sum, expense) => sum + expense.amount, 0);

  const budgetSnapshot = {
    monthlyIncome: averageNet,
    suggestedNeeds: averageNet * 0.5,
    suggestedWants: averageNet * 0.3,
    suggestedSavings: averageNet * 0.2,
    trackedExpenses,
    recurringExpenses,
    upcomingExpenses,
    availableAfterTracked: averageNet - trackedExpenses,
    goalsTargetTotal: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
    goalsProgressTotal: goals.reduce((sum, goal) => sum + goal.progressAmount, 0)
  };

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
    monthlySeries,
    budgetSnapshot,
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
