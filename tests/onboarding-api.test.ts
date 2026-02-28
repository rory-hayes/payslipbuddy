import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { GET, POST } from "@/app/api/onboarding/profile/route";

beforeEach(() => {
  // @ts-expect-error test-only reset
  global.__PAYSLIP_BUDDY_STATE__ = undefined;
});

describe("onboarding profile api", () => {
  it("persists IE region and skipped budget state", async () => {
    const postResponse = await POST(
      new Request("http://localhost/api/onboarding/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_ie",
          region: "IE",
          householdName: "Hayes Household",
          employerName: "OpenAI",
          reminderEnabled: true,
          completeOnboarding: true,
          budget: {
            skipped: true,
            recurringExpenses: [],
            upcomingExpenses: [],
            goals: []
          }
        })
      })
    );

    expect(postResponse.status).toBe(200);
    const postPayload = (await postResponse.json()) as {
      ok: boolean;
      data: {
        user: {
          region: "UK" | "IE";
          currency: "GBP" | "EUR";
          budgetSetupCompleted: boolean;
        };
      };
    };
    expect(postPayload.ok).toBe(true);
    expect(postPayload.data.user.region).toBe("IE");
    expect(postPayload.data.user.currency).toBe("EUR");
    expect(postPayload.data.user.budgetSetupCompleted).toBe(false);

    const getResponse = await GET(new Request("http://localhost/api/onboarding/profile?userId=user_ie"));
    expect(getResponse.status).toBe(200);
    const getPayload = (await getResponse.json()) as {
      ok: boolean;
      data: {
        user: {
          region: "UK" | "IE";
          currency: "GBP" | "EUR";
          budgetSetupCompleted: boolean;
        };
      };
    };
    expect(getPayload.ok).toBe(true);
    expect(getPayload.data.user.region).toBe("IE");
    expect(getPayload.data.user.currency).toBe("EUR");
    expect(getPayload.data.user.budgetSetupCompleted).toBe(false);
  });

  it("creates starter budget data and marks setup complete", async () => {
    const response = await POST(
      new Request("http://localhost/api/onboarding/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_budget",
          region: "UK",
          householdName: "Budget Home",
          employerName: "Primary Ltd",
          completeOnboarding: true,
          monthlyIncomeTarget: 3200,
          budget: {
            skipped: false,
            monthlyIncomeTarget: 3200,
            recurringExpenses: [{ category: "Rent", amount: 1200 }],
            upcomingExpenses: [{ category: "Car service", amount: 240, dueDate: "2026-03-12" }],
            goals: [{ name: "Emergency fund", targetAmount: 5000, targetDate: "2026-12-31" }]
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        user: {
          budgetSetupCompleted: boolean;
          monthlyIncomeTarget: number | null;
        };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.user.budgetSetupCompleted).toBe(true);
    expect(payload.data.user.monthlyIncomeTarget).toBe(3200);

    const user = inMemoryDb.getUser("user_budget");
    expect(user?.budgetSetupCompleted).toBe(true);
    const household = inMemoryDb.listHouseholdsByUser("user_budget")[0];
    if (!household) {
      throw new Error("missing household");
    }
    expect(inMemoryDb.listExpensesByHousehold(household.id)).toHaveLength(2);
    expect(inMemoryDb.listGoalsByHousehold(household.id)).toHaveLength(1);
  });
});
