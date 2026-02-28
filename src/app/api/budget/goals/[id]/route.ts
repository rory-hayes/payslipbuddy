import { forbidden, notFound, ok, parseBody, serverError } from "@/lib/http";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { canAccessGoal, syncBudgetSetupCompletion } from "@/lib/services/budget";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { updateGoalBodySchema } from "@/lib/validation/schemas";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await parseBody(request, updateGoalBodySchema);
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

    const goalId = (await context.params).id;
    const goal = inMemoryDb.getGoal(goalId);
    if (!goal) {
      return notFound("Goal not found.");
    }

    if (!canAccessGoal(resolved.data.userId, goal)) {
      return forbidden("You do not have access to this goal.");
    }

    const updated = inMemoryDb.updateGoal(goalId, {
      name: body.data.name?.trim(),
      targetAmount: body.data.targetAmount,
      targetDate: body.data.targetDate ?? null,
      progressAmount: body.data.progressAmount
    });

    if (!updated) {
      return notFound("Goal not found.");
    }

    syncBudgetSetupCompletion(resolved.data.userId, updated.householdId);

    return ok({
      goal: updated
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update goal.");
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

    const goalId = (await context.params).id;
    const goal = inMemoryDb.getGoal(goalId);
    if (!goal) {
      return notFound("Goal not found.");
    }

    if (!canAccessGoal(resolved.data.userId, goal)) {
      return forbidden("You do not have access to this goal.");
    }

    inMemoryDb.deleteGoal(goalId);
    syncBudgetSetupCompletion(resolved.data.userId, goal.householdId);
    return ok({ deleted: true });
  } catch (error) {
    console.error(error);
    return serverError("Failed to delete goal.");
  }
}
