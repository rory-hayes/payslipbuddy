import { created, forbidden, ok, parseBody, serverError } from "@/lib/http";
import { canCreateBudgetExpense } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { createExpenseBodySchema } from "@/lib/validation/schemas";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { resolveBudgetHousehold, syncBudgetSetupCompletion } from "@/lib/services/budget";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resolved = await resolveRequestUser({
      request,
      queryUserId: url.searchParams.get("userId")
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const householdResult = resolveBudgetHousehold(user.id, url.searchParams.get("householdId"));
    if (householdResult.error || !householdResult.householdId) {
      return forbidden(householdResult.error ?? "Household access denied.");
    }

    const rows = inMemoryDb.listExpensesByHousehold(householdResult.householdId);

    return ok({
      householdId: householdResult.householdId,
      rows,
      user: {
        region: user.region,
        currency: user.currency,
        monthlyIncomeTarget: user.monthlyIncomeTarget,
        budgetSetupCompleted: user.budgetSetupCompleted
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to load budget expenses.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, createExpenseBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: body.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const householdResult = resolveBudgetHousehold(user.id, body.data.householdId);
    if (householdResult.error || !householdResult.householdId) {
      return forbidden(householdResult.error ?? "Household access denied.");
    }

    const existingCount = inMemoryDb.listExpensesByHousehold(householdResult.householdId).length;
    const gate = canCreateBudgetExpense(user.id, existingCount);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Budget expense limit reached.");
    }

    const expense = inMemoryDb.addExpense({
      householdId: householdResult.householdId,
      category: body.data.category.trim(),
      kind: body.data.kind,
      amount: body.data.amount,
      dueDate: body.data.dueDate ?? null,
      recurrence: body.data.recurrence ?? null,
      notes: body.data.notes ?? null,
      createdBy: user.id
    });

    syncBudgetSetupCompletion(user.id, householdResult.householdId);

    return created({
      expense
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to create budget expense.");
  }
}
