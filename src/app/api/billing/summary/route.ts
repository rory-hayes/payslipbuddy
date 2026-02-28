import { inMemoryDb } from "@/lib/db/in-memory-db";
import { ok } from "@/lib/http";
import { usageMeter } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";

export async function GET(request: Request) {
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

  return ok({
    user: {
      id: user.id,
      plan: user.plan,
      billingCycle: user.billingCycle,
      region: user.region,
      reminderEnabled: user.reminderEnabled,
      canManageBilling: inMemoryDb.isOwnerOfAnyHousehold(user.id)
    },
    usage: usageMeter(user.id)
  });
}
