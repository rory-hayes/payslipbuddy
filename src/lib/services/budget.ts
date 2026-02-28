import { inMemoryDb } from "@/lib/db/in-memory-db";
import type { Expense, Goal } from "@/lib/types/domain";

export function getPrimaryHouseholdForUser(userId: string) {
  const households = inMemoryDb.listHouseholdsByUser(userId);
  return households[0] ?? null;
}

export function userCanAccessHousehold(userId: string, householdId: string): boolean {
  const households = inMemoryDb.listHouseholdsByUser(userId);
  return households.some((household) => household.id === householdId);
}

export function resolveBudgetHousehold(userId: string, requestedHouseholdId?: string | null) {
  if (requestedHouseholdId) {
    if (!userCanAccessHousehold(userId, requestedHouseholdId)) {
      return {
        householdId: null,
        error: "You do not have access to this household."
      };
    }

    return {
      householdId: requestedHouseholdId,
      error: null
    };
  }

  const primary = getPrimaryHouseholdForUser(userId);
  if (!primary) {
    return {
      householdId: null,
      error: "No active household found."
    };
  }

  return {
    householdId: primary.id,
    error: null
  };
}

export function canAccessExpense(userId: string, expense: Expense): boolean {
  return userCanAccessHousehold(userId, expense.householdId);
}

export function canAccessGoal(userId: string, goal: Goal): boolean {
  return userCanAccessHousehold(userId, goal.householdId);
}

export function syncBudgetSetupCompletion(userId: string, householdId: string): boolean {
  const recurringCount = inMemoryDb
    .listExpensesByHousehold(householdId)
    .filter((expense) => expense.kind === "RECURRING").length;
  const goalCount = inMemoryDb.listGoalsByHousehold(householdId).length;
  const completed = recurringCount > 0 || goalCount > 0;
  inMemoryDb.setBudgetSetupCompleted(userId, completed);
  return completed;
}
