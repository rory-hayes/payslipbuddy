import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { canCreateBudgetExpense, canCreateBudgetGoal } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";

const nonNegativeNumber = z.number().finite().nonnegative();

const onboardingSchema = z.object({
  userId: z.string().min(1),
  region: z.enum(["UK", "IE"]),
  householdName: z.string().trim().min(2).max(80).optional(),
  employerName: z.string().trim().min(2).max(100).optional(),
  reminderEnabled: z.boolean().optional(),
  monthlyIncomeTarget: nonNegativeNumber.nullable().optional(),
  completeOnboarding: z.boolean().optional().default(true),
  budget: z
    .object({
      skipped: z.boolean(),
      monthlyIncomeTarget: nonNegativeNumber.nullable().optional(),
      recurringExpenses: z
        .array(
          z.object({
            category: z.string().trim().min(1).max(80),
            amount: nonNegativeNumber
          })
        )
        .default([]),
      upcomingExpenses: z
        .array(
          z.object({
            category: z.string().trim().min(1).max(80),
            amount: nonNegativeNumber,
            dueDate: z.string().optional().nullable()
          })
        )
        .default([]),
      goals: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(100),
            targetAmount: nonNegativeNumber,
            targetDate: z.string().optional().nullable()
          })
        )
        .default([])
    })
    .optional()
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = onboardingSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid onboarding payload.", parsed.error.flatten());
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: parsed.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const updatedRegion = inMemoryDb.updateUserRegion(user.id, parsed.data.region);
    if (!updatedRegion) {
      return notFound("User not found.");
    }

    if (typeof parsed.data.reminderEnabled === "boolean") {
      inMemoryDb.setReminderEnabled(user.id, parsed.data.reminderEnabled);
    }

    if (typeof parsed.data.monthlyIncomeTarget !== "undefined") {
      inMemoryDb.setMonthlyIncomeTarget(user.id, parsed.data.monthlyIncomeTarget ?? null);
    }

    const households = inMemoryDb.listHouseholdsByUser(user.id);
    const primaryHousehold = households[0] ?? null;
    if (!primaryHousehold) {
      return notFound("Primary household not found.");
    }

    if (parsed.data.householdName) {
      inMemoryDb.updateHouseholdName(primaryHousehold.id, parsed.data.householdName);
    }

    if (parsed.data.employerName) {
      const normalizedName = parsed.data.employerName.trim().toLowerCase();
      const employers = inMemoryDb.listEmployersByUser(user.id);
      const alreadyExists = employers.some((employer) => employer.name.trim().toLowerCase() === normalizedName);

      if (!alreadyExists) {
        inMemoryDb.addEmployer({
          userId: user.id,
          name: parsed.data.employerName.trim()
        });
      }
    }

    if (parsed.data.budget) {
      const budget = parsed.data.budget;
      const target = budget.monthlyIncomeTarget;
      if (typeof target !== "undefined") {
        inMemoryDb.setMonthlyIncomeTarget(user.id, target ?? null);
      }

      if (budget.skipped) {
        inMemoryDb.setBudgetSetupCompleted(user.id, false);
      } else {
        const hasRecurring = budget.recurringExpenses.length > 0;
        const hasGoals = budget.goals.length > 0;
        if (!hasRecurring && !hasGoals) {
          return badRequest("Add at least one recurring expense or one savings goal to complete budget setup.");
        }

        const existingExpenses = inMemoryDb.listExpensesByHousehold(primaryHousehold.id).length;
        const existingGoals = inMemoryDb.listGoalsByHousehold(primaryHousehold.id).length;
        const addedExpenses = budget.recurringExpenses.length + budget.upcomingExpenses.length;
        const addedGoals = budget.goals.length;

        const expenseGate = canCreateBudgetExpense(user.id, existingExpenses + addedExpenses - 1);
        if (!expenseGate.allowed) {
          return forbidden(expenseGate.reason ?? "Budget expense limit reached.");
        }

        const goalGate = canCreateBudgetGoal(user.id, existingGoals + addedGoals - 1);
        if (!goalGate.allowed) {
          return forbidden(goalGate.reason ?? "Budget goal limit reached.");
        }

        for (const expense of budget.recurringExpenses) {
          inMemoryDb.addExpense({
            householdId: primaryHousehold.id,
            category: expense.category.trim(),
            kind: "RECURRING",
            amount: expense.amount,
            dueDate: null,
            recurrence: "monthly",
            notes: "Created during onboarding",
            createdBy: user.id
          });
        }

        for (const expense of budget.upcomingExpenses) {
          inMemoryDb.addExpense({
            householdId: primaryHousehold.id,
            category: expense.category.trim(),
            kind: "UPCOMING",
            amount: expense.amount,
            dueDate: expense.dueDate ?? null,
            recurrence: null,
            notes: "Created during onboarding",
            createdBy: user.id
          });
        }

        for (const goal of budget.goals) {
          inMemoryDb.addGoal({
            householdId: primaryHousehold.id,
            name: goal.name.trim(),
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate ?? null,
            progressAmount: 0
          });
        }

        inMemoryDb.setBudgetSetupCompleted(user.id, true);
      }
    }

    if (parsed.data.completeOnboarding) {
      const completed = inMemoryDb.setOnboardingCompleted(user.id, true);
      if (!completed) {
        return notFound("User not found.");
      }
    }

    const refreshedUser = inMemoryDb.getUser(user.id);
    if (!refreshedUser) {
      return notFound("User not found.");
    }

    const recurringExpenses = inMemoryDb
      .listExpensesByHousehold(primaryHousehold.id)
      .filter((expense) => expense.kind === "RECURRING")
      .map((expense) => ({
        id: expense.id,
        category: expense.category,
        amount: expense.amount
      }));
    const upcomingExpenses = inMemoryDb
      .listExpensesByHousehold(primaryHousehold.id)
      .filter((expense) => expense.kind === "UPCOMING")
      .map((expense) => ({
        id: expense.id,
        category: expense.category,
        amount: expense.amount,
        dueDate: expense.dueDate ?? null
      }));
    const goals = inMemoryDb.listGoalsByHousehold(primaryHousehold.id).map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate ?? null,
      progressAmount: goal.progressAmount
    }));

    return ok({
      user: {
        id: refreshedUser.id,
        region: refreshedUser.region,
        currency: refreshedUser.currency,
        reminderEnabled: refreshedUser.reminderEnabled,
        onboardingCompleted: refreshedUser.onboardingCompleted,
        budgetSetupCompleted: refreshedUser.budgetSetupCompleted,
        monthlyIncomeTarget: refreshedUser.monthlyIncomeTarget
      },
      household: inMemoryDb.getHousehold(primaryHousehold.id),
      employers: inMemoryDb.listEmployersByUser(user.id),
      budgetSeed: {
        recurringExpenses,
        upcomingExpenses,
        goals
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to complete onboarding.");
  }
}

export async function GET(request: Request) {
  try {
    const resolved = await resolveRequestUser({
      request,
      queryUserId: new URL(request.url).searchParams.get("userId")
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });
    const households = inMemoryDb.listHouseholdsByUser(user.id);
    const primaryHousehold = households[0] ?? null;
    const employers = inMemoryDb.listEmployersByUser(user.id);
    const expenses = primaryHousehold ? inMemoryDb.listExpensesByHousehold(primaryHousehold.id) : [];
    const goals = primaryHousehold ? inMemoryDb.listGoalsByHousehold(primaryHousehold.id) : [];

    return ok({
      user: {
        id: user.id,
        region: user.region,
        currency: user.currency,
        reminderEnabled: user.reminderEnabled,
        onboardingCompleted: user.onboardingCompleted,
        budgetSetupCompleted: user.budgetSetupCompleted,
        monthlyIncomeTarget: user.monthlyIncomeTarget
      },
      household: primaryHousehold,
      employers,
      budgetSeed: {
        recurringExpenses: expenses
          .filter((expense) => expense.kind === "RECURRING")
          .map((expense) => ({
            id: expense.id,
            category: expense.category,
            amount: expense.amount
          })),
        upcomingExpenses: expenses
          .filter((expense) => expense.kind === "UPCOMING")
          .map((expense) => ({
            id: expense.id,
            category: expense.category,
            amount: expense.amount,
            dueDate: expense.dueDate ?? null
          })),
        goals: goals.map((goal) => ({
          id: goal.id,
          name: goal.name,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate ?? null,
          progressAmount: goal.progressAmount
        }))
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to load onboarding profile.");
  }
}
