import { created, forbidden, ok, parseBody, serverError } from "@/lib/http";
import { canCreateBudgetGoal } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { createGoalBodySchema } from "@/lib/validation/schemas";
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

    const rows = inMemoryDb.listGoalsByHousehold(householdResult.householdId);

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
    return serverError("Failed to load goals.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, createGoalBodySchema);
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

    const existingCount = inMemoryDb.listGoalsByHousehold(householdResult.householdId).length;
    const gate = canCreateBudgetGoal(user.id, existingCount);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Budget goal limit reached.");
    }

    const goal = inMemoryDb.addGoal({
      householdId: householdResult.householdId,
      name: body.data.name.trim(),
      targetAmount: body.data.targetAmount,
      targetDate: body.data.targetDate ?? null,
      progressAmount: body.data.progressAmount ?? 0
    });

    syncBudgetSetupCompletion(user.id, householdResult.householdId);

    return created({
      goal
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to create goal.");
  }
}
