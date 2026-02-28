import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok } from "@/lib/http";
import { usageMeter } from "@/lib/services/entitlements";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return notFound("User not found.");
  }

  return ok({
    user: {
      id: user.id,
      plan: user.plan,
      billingCycle: user.billingCycle,
      region: user.region,
      reminderEnabled: user.reminderEnabled,
      canManageBilling: inMemoryDb.isOwnerOfAnyHousehold(user.id)
    },
    usage: usageMeter(userId)
  });
}
