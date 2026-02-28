import { inMemoryDb } from "@/lib/db/in-memory-db";
import { usageMeter } from "@/lib/services/entitlements";
import { calculateMomDiff, detectLineItemChanges } from "@/lib/services/mom";

const categoryTargets = [
  { name: "Bills", ratio: 0.35, accent: "blue" },
  { name: "Shopping", ratio: 0.2, accent: "amber" },
  { name: "Transport", ratio: 0.12, accent: "orange" },
  { name: "Entertainment", ratio: 0.18, accent: "fuchsia" },
  { name: "Others", ratio: 0.15, accent: "zinc" }
] as const;

function budgetCategoryFromExpense(category: string): (typeof categoryTargets)[number]["name"] {
  const normalized = category.trim().toLowerCase();
  if (["bill", "bills", "rent", "mortgage", "utilities", "utilities and bills"].some((item) => normalized.includes(item))) {
    return "Bills";
  }
  if (["shop", "shopping", "grocery", "groceries", "retail"].some((item) => normalized.includes(item))) {
    return "Shopping";
  }
  if (["transport", "travel", "fuel", "car", "bus", "train", "taxi"].some((item) => normalized.includes(item))) {
    return "Transport";
  }
  if (["entertainment", "fun", "leisure", "subscriptions", "streaming"].some((item) => normalized.includes(item))) {
    return "Entertainment";
  }
  return "Others";
}

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

  const monthlyIncomeTarget = user.monthlyIncomeTarget ?? averageNet;

  const trackedExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recurringExpenses = expenses
    .filter((expense) => expense.kind === "RECURRING")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const upcomingExpenses = expenses
    .filter((expense) => expense.kind === "UPCOMING")
    .reduce((sum, expense) => sum + expense.amount, 0);

  const budgetSnapshot = {
    monthlyIncome: monthlyIncomeTarget,
    suggestedNeeds: monthlyIncomeTarget * 0.5,
    suggestedWants: monthlyIncomeTarget * 0.3,
    suggestedSavings: monthlyIncomeTarget * 0.2,
    trackedExpenses,
    recurringExpenses,
    upcomingExpenses,
    availableAfterTracked: monthlyIncomeTarget - trackedExpenses,
    goalsTargetTotal: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
    goalsProgressTotal: goals.reduce((sum, goal) => sum + goal.progressAmount, 0)
  };

  const categorySpent = new Map<(typeof categoryTargets)[number]["name"], number>(
    categoryTargets.map((item) => [item.name, 0])
  );
  for (const expense of expenses) {
    const bucket = budgetCategoryFromExpense(expense.category);
    categorySpent.set(bucket, (categorySpent.get(bucket) ?? 0) + expense.amount);
  }

  const budgetBase = Math.max(budgetSnapshot.monthlyIncome, budgetSnapshot.trackedExpenses, 0);
  const budgetCategories = categoryTargets.map((item) => {
    const budget = budgetBase * item.ratio;
    const spent = categorySpent.get(item.name) ?? 0;
    const spentPercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
    return {
      category: item.name,
      accent: item.accent,
      spent,
      budget,
      spentPercent
    };
  });

  const spendingRatio =
    budgetSnapshot.monthlyIncome > 0 ? (budgetSnapshot.trackedExpenses / budgetSnapshot.monthlyIncome) * 100 : 0;
  const spendingStatus =
    spendingRatio <= 60 ? "GOOD" : spendingRatio <= 85 ? "WATCH" : "HIGH";

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
    budgetCategories,
    spendingStatus: {
      label: spendingStatus,
      percent: Number.isFinite(spendingRatio) ? spendingRatio : 0
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      progressAmount: goal.progressAmount,
      targetDate: goal.targetDate ?? null,
      progressPercent: goal.targetAmount > 0 ? Math.min(100, (goal.progressAmount / goal.targetAmount) * 100) : 0
    })),
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
