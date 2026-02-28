import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { POST as createExpense } from "@/app/api/budget/expenses/route";
import { DELETE as deleteExpense } from "@/app/api/budget/expenses/[id]/route";
import { POST as createGoal } from "@/app/api/budget/goals/route";

beforeEach(() => {
  // @ts-expect-error test-only reset
  global.__PAYSLIP_BUDDY_STATE__ = undefined;
});

describe("budget api", () => {
  it("blocks creating an 11th expense on free plan", async () => {
    const user = inMemoryDb.ensureUser({ id: "budget_limit_user" });
    const household = inMemoryDb.listHouseholdsByUser(user.id)[0];
    if (!household) {
      throw new Error("missing household");
    }

    for (let index = 0; index < 10; index += 1) {
      inMemoryDb.addExpense({
        householdId: household.id,
        category: `Expense ${index + 1}`,
        kind: "RECURRING",
        amount: 100,
        dueDate: null,
        recurrence: "monthly",
        notes: null,
        createdBy: user.id
      });
    }

    const response = await createExpense(
      new Request("http://localhost/api/budget/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          category: "Overflow",
          kind: "RECURRING",
          amount: 120
        })
      })
    );

    expect(response.status).toBe(403);
    const payload = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toContain("10 expenses");
  });

  it("blocks creating a third goal on free plan", async () => {
    const user = inMemoryDb.ensureUser({ id: "goal_limit_user" });
    const household = inMemoryDb.listHouseholdsByUser(user.id)[0];
    if (!household) {
      throw new Error("missing household");
    }

    inMemoryDb.addGoal({
      householdId: household.id,
      name: "Goal 1",
      targetAmount: 1000,
      targetDate: null,
      progressAmount: 0
    });
    inMemoryDb.addGoal({
      householdId: household.id,
      name: "Goal 2",
      targetAmount: 2000,
      targetDate: null,
      progressAmount: 0
    });

    const response = await createGoal(
      new Request("http://localhost/api/budget/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: "Goal 3",
          targetAmount: 3000
        })
      })
    );

    expect(response.status).toBe(403);
    const payload = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toContain("2 goals");
  });

  it("marks budget setup complete when recurring expense exists and false when removed", async () => {
    const user = inMemoryDb.ensureUser({ id: "budget_setup_user" });
    const createResponse = await createExpense(
      new Request("http://localhost/api/budget/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          category: "Rent",
          kind: "RECURRING",
          amount: 1400
        })
      })
    );

    expect(createResponse.status).toBe(201);
    expect(inMemoryDb.getUser(user.id)?.budgetSetupCompleted).toBe(true);

    const createdPayload = (await createResponse.json()) as {
      ok: boolean;
      data: {
        expense: {
          id: string;
        };
      };
    };

    const deleteResponse = await deleteExpense(
      new Request(`http://localhost/api/budget/expenses/${createdPayload.data.expense.id}?userId=${user.id}`, {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: createdPayload.data.expense.id }) }
    );

    expect(deleteResponse.status).toBe(200);
    expect(inMemoryDb.getUser(user.id)?.budgetSetupCompleted).toBe(false);
  });
});
