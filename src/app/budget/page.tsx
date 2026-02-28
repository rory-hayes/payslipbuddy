"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Field, FieldGroup, Fieldset, Label, Legend } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";

interface ExpenseRecord {
  id: string;
  householdId: string;
  category: string;
  kind: "RECURRING" | "UPCOMING" | "ONE_OFF";
  amount: number;
  dueDate?: string | null;
  recurrence?: string | null;
  notes?: string | null;
}

interface GoalRecord {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  targetDate?: string | null;
  progressAmount: number;
}

interface OnboardingProfileResponse {
  user: {
    region: "UK" | "IE";
    currency: "GBP" | "EUR";
    monthlyIncomeTarget: number | null;
  };
}

interface EditableExpense {
  id: string;
  householdId: string;
  category: string;
  kind: "RECURRING" | "UPCOMING" | "ONE_OFF";
  amount: string;
  dueDate: string;
  recurrence: string;
  notes: string;
}

interface EditableGoal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  progressAmount: string;
}

function toCurrency(value: number, currency: "GBP" | "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function asNonNegativeNumber(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function mapExpense(row: ExpenseRecord): EditableExpense {
  return {
    id: row.id,
    householdId: row.householdId,
    category: row.category,
    kind: row.kind,
    amount: row.amount.toString(),
    dueDate: row.dueDate ?? "",
    recurrence: row.recurrence ?? "",
    notes: row.notes ?? ""
  };
}

function mapGoal(row: GoalRecord): EditableGoal {
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    targetAmount: row.targetAmount.toString(),
    targetDate: row.targetDate ?? "",
    progressAmount: row.progressAmount.toString()
  };
}

export default function BudgetPage() {
  const { user, loading } = useRequireAuth();

  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [currency, setCurrency] = useState<"GBP" | "EUR">("GBP");
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState("");
  const [expenses, setExpenses] = useState<EditableExpense[]>([]);
  const [goals, setGoals] = useState<EditableGoal[]>([]);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestVersionRef = useRef(0);

  const [newRecurringCategory, setNewRecurringCategory] = useState("");
  const [newRecurringAmount, setNewRecurringAmount] = useState("");
  const [newUpcomingCategory, setNewUpcomingCategory] = useState("");
  const [newUpcomingAmount, setNewUpcomingAmount] = useState("");
  const [newUpcomingDate, setNewUpcomingDate] = useState("");

  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDate, setNewGoalDate] = useState("");

  const loadBudget = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setBusy(true);
    setError("");

    const [expenseResult, goalResult, profileResult] = await Promise.all([
      apiFetch<{
        rows: ExpenseRecord[];
        user: {
          region: "UK" | "IE";
          currency: "GBP" | "EUR";
          monthlyIncomeTarget: number | null;
          budgetSetupCompleted: boolean;
        };
      }>(`/api/budget/expenses?userId=${user.id}`),
      apiFetch<{
        rows: GoalRecord[];
        user: {
          region: "UK" | "IE";
          currency: "GBP" | "EUR";
          monthlyIncomeTarget: number | null;
          budgetSetupCompleted: boolean;
        };
      }>(`/api/budget/goals?userId=${user.id}`),
      apiFetch<OnboardingProfileResponse>(`/api/onboarding/profile?userId=${user.id}`)
    ]);

    if (requestVersion !== requestVersionRef.current) {
      return;
    }

    setBusy(false);
    setHasLoaded(true);
    const errors: string[] = [];

    if (expenseResult.ok && expenseResult.data) {
      setExpenses(expenseResult.data.rows.map(mapExpense));
      setRegion(expenseResult.data.user.region);
      setCurrency(expenseResult.data.user.currency);
      setMonthlyIncomeTarget(
        expenseResult.data.user.monthlyIncomeTarget != null
          ? expenseResult.data.user.monthlyIncomeTarget.toString()
          : ""
      );
    } else {
      errors.push(expenseResult.error?.message ?? "Could not load budget expenses.");
    }

    if (goalResult.ok && goalResult.data) {
      setGoals(goalResult.data.rows.map(mapGoal));
    } else {
      errors.push(goalResult.error?.message ?? "Could not load goals.");
    }

    if (profileResult.ok && profileResult.data) {
      setRegion(profileResult.data.user.region);
      setCurrency(profileResult.data.user.currency);
      setMonthlyIncomeTarget(
        profileResult.data.user.monthlyIncomeTarget != null
          ? profileResult.data.user.monthlyIncomeTarget.toString()
          : ""
      );
    } else if (!expenseResult.ok) {
      errors.push(profileResult.error?.message ?? "Could not load profile defaults.");
    }

    if (errors.length > 0) {
      setError(errors[0] ?? "Could not load budget board.");
    } else {
      setError("");
    }
  }, [requestVersionRef, user?.id]);

  useEffect(() => {
    void loadBudget();
  }, [loadBudget]);

  const recurringExpenses = useMemo(() => expenses.filter((expense) => expense.kind === "RECURRING"), [expenses]);
  const upcomingExpenses = useMemo(() => expenses.filter((expense) => expense.kind === "UPCOMING"), [expenses]);

  const trackedExpenseTotal = useMemo(
    () => expenses.reduce((sum, row) => sum + (asNonNegativeNumber(row.amount) ?? 0), 0),
    [expenses]
  );
  const monthlyIncomeNumber = asNonNegativeNumber(monthlyIncomeTarget) ?? 0;
  const availableAfterExpenses = monthlyIncomeNumber - trackedExpenseTotal;
  const goalTargetTotal = goals.reduce((sum, goal) => sum + (asNonNegativeNumber(goal.targetAmount) ?? 0), 0);
  const goalProgressTotal = goals.reduce((sum, goal) => sum + (asNonNegativeNumber(goal.progressAmount) ?? 0), 0);

  async function saveMonthlyIncomeTarget() {
    if (!user?.id) {
      return;
    }

    const value = monthlyIncomeTarget.trim() ? asNonNegativeNumber(monthlyIncomeTarget) : null;
    if (monthlyIncomeTarget.trim() && value == null) {
      setStatus("Monthly take-home baseline must be a non-negative number.");
      return;
    }

    setStatus("");
    const result = await apiFetch<unknown>("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        region,
        completeOnboarding: false,
        monthlyIncomeTarget: value
      })
    });

    if (!result.ok) {
      setStatus(result.error?.message ?? "Could not update monthly take-home baseline.");
      return;
    }

    setStatus("Monthly take-home baseline saved.");
  }

  async function createExpense(input: { kind: "RECURRING" | "UPCOMING"; category: string; amount: string; dueDate?: string }) {
    if (!user?.id) {
      return;
    }

    const amount = asNonNegativeNumber(input.amount);
    if (input.category.trim().length === 0 || amount == null) {
      setStatus("Add category and valid amount before creating an expense.");
      return;
    }

    setStatus("");
    const result = await apiFetch<{ expense: ExpenseRecord }>("/api/budget/expenses", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        category: input.category.trim(),
        amount,
        kind: input.kind,
        dueDate: input.kind === "UPCOMING" ? input.dueDate || null : null,
        recurrence: input.kind === "RECURRING" ? "monthly" : null
      })
    });

    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not create expense.");
      return;
    }

    const createdExpense = result.data.expense;
    setExpenses((rows) => [...rows, mapExpense(createdExpense)]);
    if (input.kind === "RECURRING") {
      setNewRecurringCategory("");
      setNewRecurringAmount("");
    } else {
      setNewUpcomingCategory("");
      setNewUpcomingAmount("");
      setNewUpcomingDate("");
    }
    setStatus("Expense added.");
  }

  async function updateExpense(expense: EditableExpense) {
    if (!user?.id) {
      return;
    }

    const amount = asNonNegativeNumber(expense.amount);
    if (expense.category.trim().length === 0 || amount == null) {
      setStatus("Each expense requires category and non-negative amount.");
      return;
    }

    setStatus("");
    const result = await apiFetch<{ expense: ExpenseRecord }>(`/api/budget/expenses/${expense.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: user.id,
        category: expense.category.trim(),
        kind: expense.kind,
        amount,
        dueDate: expense.dueDate || null,
        recurrence: expense.kind === "RECURRING" ? expense.recurrence || "monthly" : null,
        notes: expense.notes || null
      })
    });

    if (!result.ok) {
      setStatus(result.error?.message ?? "Could not update expense.");
      return;
    }

    setStatus("Expense updated.");
  }

  async function removeExpense(expenseId: string) {
    if (!user?.id) {
      return;
    }

    const result = await apiFetch<{ deleted: boolean }>(`/api/budget/expenses/${expenseId}?userId=${user.id}`, {
      method: "DELETE"
    });

    if (!result.ok) {
      setStatus(result.error?.message ?? "Could not delete expense.");
      return;
    }

    setExpenses((rows) => rows.filter((row) => row.id !== expenseId));
    setStatus("Expense removed.");
  }

  async function createGoal() {
    if (!user?.id) {
      return;
    }

    const target = asNonNegativeNumber(newGoalTarget);
    if (newGoalName.trim().length === 0 || target == null) {
      setStatus("Add goal name and non-negative target amount.");
      return;
    }

    setStatus("");
    const result = await apiFetch<{ goal: GoalRecord }>("/api/budget/goals", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        name: newGoalName.trim(),
        targetAmount: target,
        targetDate: newGoalDate || null,
        progressAmount: 0
      })
    });

    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not create goal.");
      return;
    }

    const createdGoal = result.data.goal;
    setGoals((rows) => [...rows, mapGoal(createdGoal)]);
    setNewGoalName("");
    setNewGoalTarget("");
    setNewGoalDate("");
    setStatus("Goal added.");
  }

  async function updateGoal(goal: EditableGoal) {
    if (!user?.id) {
      return;
    }

    const target = asNonNegativeNumber(goal.targetAmount);
    const progress = asNonNegativeNumber(goal.progressAmount);
    if (goal.name.trim().length === 0 || target == null || progress == null) {
      setStatus("Each goal requires a name and non-negative target/progress values.");
      return;
    }

    setStatus("");
    const result = await apiFetch<{ goal: GoalRecord }>(`/api/budget/goals/${goal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: user.id,
        name: goal.name.trim(),
        targetAmount: target,
        targetDate: goal.targetDate || null,
        progressAmount: progress
      })
    });

    if (!result.ok) {
      setStatus(result.error?.message ?? "Could not update goal.");
      return;
    }

    setStatus("Goal updated.");
  }

  async function removeGoal(goalId: string) {
    if (!user?.id) {
      return;
    }

    const result = await apiFetch<{ deleted: boolean }>(`/api/budget/goals/${goalId}?userId=${user.id}`, {
      method: "DELETE"
    });

    if (!result.ok) {
      setStatus(result.error?.message ?? "Could not delete goal.");
      return;
    }

    setGoals((rows) => rows.filter((row) => row.id !== goalId));
    setStatus("Goal removed.");
  }

  if (loading) {
    return <Text>Loading budget board...</Text>;
  }

  if (!hasLoaded && busy) {
    return <Text>Loading budget data...</Text>;
  }

  return (
    <PageShell
      title="Budget Board"
      subtitle="Track monthly budget targets, recurring and upcoming expenses, and household savings goals."
      actions={
        <div className="flex items-center gap-2">
          <Badge color="blue">Manual Budget V1</Badge>
          <Button href="/settings" outline>
            Profile Settings
          </Button>
        </div>
      }
    >
      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
      {status ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{status}</div> : null}
      {busy ? <Text>Refreshing budget data...</Text> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Text>Monthly take-home baseline</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-emerald-600">{toCurrency(monthlyIncomeNumber, currency)}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Text>Tracked expenses</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-rose-600">{toCurrency(trackedExpenseTotal, currency)}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Text>Available</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-blue-600">{toCurrency(availableAfterExpenses, currency)}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Text>Goals progress</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-fuchsia-600">
            {goalTargetTotal > 0 ? `${Math.min(100, (goalProgressTotal / goalTargetTotal) * 100).toFixed(1)}%` : "0.0%"}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>Monthly Income Baseline</Subheading>
        <Text className="mt-1">
          Set your expected monthly take-home pay in {region === "UK" ? "GBP" : "EUR"}.
          {" "}
          This is for budget planning, not a savings goal.
        </Text>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={monthlyIncomeTarget}
            onChange={(event) => setMonthlyIncomeTarget(event.target.value)}
            placeholder="Expected monthly take-home pay"
            className="w-full max-w-xs"
          />
          <Button type="button" onClick={() => void saveMonthlyIncomeTarget()}>
            Save target
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>Recurring Expenses</Subheading>
          <Text className="mt-1">Monthly items that repeat consistently.</Text>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
            <Input
              value={newRecurringCategory}
              onChange={(event) => setNewRecurringCategory(event.target.value)}
              placeholder="Category"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={newRecurringAmount}
              onChange={(event) => setNewRecurringAmount(event.target.value)}
              placeholder="Amount"
            />
            <Button
              type="button"
              onClick={() => void createExpense({ kind: "RECURRING", category: newRecurringCategory, amount: newRecurringAmount })}
            >
              Add
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {recurringExpenses.length === 0 ? (
              <Text>No recurring expenses added yet.</Text>
            ) : (
              recurringExpenses.map((expense) => (
                <div key={expense.id} className="rounded-xl border border-zinc-200 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_170px]">
                    <Input
                      value={expense.category}
                      onChange={(event) =>
                        setExpenses((rows) =>
                          rows.map((row) => (row.id === expense.id ? { ...row, category: event.target.value } : row))
                        )
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expense.amount}
                      onChange={(event) =>
                        setExpenses((rows) =>
                          rows.map((row) => (row.id === expense.id ? { ...row, amount: event.target.value } : row))
                        )
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" outline onClick={() => void updateExpense(expense)}>
                      Save
                    </Button>
                    <Button type="button" plain onClick={() => void removeExpense(expense.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>Upcoming Expenses</Subheading>
          <Text className="mt-1">Optional planned costs with a due date.</Text>

          <Fieldset className="mt-4">
            <Legend>Add upcoming expense</Legend>
            <FieldGroup className="mt-3 space-y-3">
              <Field>
                <Label>Category</Label>
                <Input value={newUpcomingCategory} onChange={(event) => setNewUpcomingCategory(event.target.value)} />
              </Field>
              <Field>
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newUpcomingAmount}
                  onChange={(event) => setNewUpcomingAmount(event.target.value)}
                />
              </Field>
              <Field>
                <Label>Due date</Label>
                <Input type="date" value={newUpcomingDate} onChange={(event) => setNewUpcomingDate(event.target.value)} />
              </Field>
            </FieldGroup>
            <div className="mt-4">
              <Button
                type="button"
                onClick={() =>
                  void createExpense({
                    kind: "UPCOMING",
                    category: newUpcomingCategory,
                    amount: newUpcomingAmount,
                    dueDate: newUpcomingDate
                  })
                }
              >
                Add expense
              </Button>
            </div>
          </Fieldset>

          <div className="mt-5 space-y-3">
            {upcomingExpenses.length === 0 ? (
              <Text>No upcoming expenses added yet.</Text>
            ) : (
              upcomingExpenses.map((expense) => (
                <div key={expense.id} className="rounded-xl border border-zinc-200 p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_160px_170px]">
                    <Input
                      value={expense.category}
                      onChange={(event) =>
                        setExpenses((rows) =>
                          rows.map((row) => (row.id === expense.id ? { ...row, category: event.target.value } : row))
                        )
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expense.amount}
                      onChange={(event) =>
                        setExpenses((rows) =>
                          rows.map((row) => (row.id === expense.id ? { ...row, amount: event.target.value } : row))
                        )
                      }
                    />
                    <Input
                      type="date"
                      value={expense.dueDate}
                      onChange={(event) =>
                        setExpenses((rows) =>
                          rows.map((row) => (row.id === expense.id ? { ...row, dueDate: event.target.value } : row))
                        )
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" outline onClick={() => void updateExpense(expense)}>
                      Save
                    </Button>
                    <Button type="button" plain onClick={() => void removeExpense(expense.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>Goals</Subheading>
        <Text className="mt-1">Create and track savings goals with optional target dates.</Text>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_170px_auto]">
          <Input value={newGoalName} onChange={(event) => setNewGoalName(event.target.value)} placeholder="Goal name" />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={newGoalTarget}
            onChange={(event) => setNewGoalTarget(event.target.value)}
            placeholder="Target amount"
          />
          <Input type="date" value={newGoalDate} onChange={(event) => setNewGoalDate(event.target.value)} />
          <Button type="button" onClick={() => void createGoal()}>
            Add goal
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {goals.length === 0 ? (
            <Text>No goals yet. Add your first goal above.</Text>
          ) : (
            goals.map((goal) => (
              <div key={goal.id} className="rounded-xl border border-zinc-200 p-3">
                <div className="grid gap-2 lg:grid-cols-[1.2fr_160px_160px_170px]">
                  <Input
                    value={goal.name}
                    onChange={(event) =>
                      setGoals((rows) =>
                        rows.map((row) => (row.id === goal.id ? { ...row, name: event.target.value } : row))
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goal.targetAmount}
                    onChange={(event) =>
                      setGoals((rows) =>
                        rows.map((row) => (row.id === goal.id ? { ...row, targetAmount: event.target.value } : row))
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goal.progressAmount}
                    onChange={(event) =>
                      setGoals((rows) =>
                        rows.map((row) => (row.id === goal.id ? { ...row, progressAmount: event.target.value } : row))
                      )
                    }
                  />
                  <Input
                    type="date"
                    value={goal.targetDate}
                    onChange={(event) =>
                      setGoals((rows) =>
                        rows.map((row) => (row.id === goal.id ? { ...row, targetDate: event.target.value } : row))
                      )
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" outline onClick={() => void updateGoal(goal)}>
                    Save
                  </Button>
                  <Button type="button" plain onClick={() => void removeGoal(goal.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}
