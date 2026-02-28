import { forbidden, notFound, ok, parseBody, serverError } from "@/lib/http";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { canAccessExpense, syncBudgetSetupCompletion } from "@/lib/services/budget";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { updateExpenseBodySchema } from "@/lib/validation/schemas";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await parseBody(request, updateExpenseBodySchema);
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

    const expenseId = (await context.params).id;
    const expense = inMemoryDb.getExpense(expenseId);
    if (!expense) {
      return notFound("Expense not found.");
    }

    if (!canAccessExpense(resolved.data.userId, expense)) {
      return forbidden("You do not have access to this expense.");
    }

    const updated = inMemoryDb.updateExpense(expenseId, {
      category: body.data.category?.trim(),
      kind: body.data.kind,
      amount: body.data.amount,
      dueDate: body.data.dueDate ?? null,
      recurrence: body.data.recurrence ?? null,
      notes: body.data.notes ?? null
    });

    if (!updated) {
      return notFound("Expense not found.");
    }

    syncBudgetSetupCompletion(resolved.data.userId, updated.householdId);

    return ok({
      expense: updated
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update expense.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveRequestUser({
      request,
      queryUserId: new URL(request.url).searchParams.get("userId")
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const expenseId = (await context.params).id;
    const expense = inMemoryDb.getExpense(expenseId);
    if (!expense) {
      return notFound("Expense not found.");
    }

    if (!canAccessExpense(resolved.data.userId, expense)) {
      return forbidden("You do not have access to this expense.");
    }

    inMemoryDb.deleteExpense(expenseId);
    syncBudgetSetupCompletion(resolved.data.userId, expense.householdId);
    return ok({ deleted: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete expense.");
  }
}
