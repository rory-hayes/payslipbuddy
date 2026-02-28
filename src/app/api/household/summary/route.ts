import { inMemoryDb } from "@/lib/db/in-memory-db";
import { ok } from "@/lib/http";
import { canUseHouseholdSharing, usageMeter } from "@/lib/services/entitlements";
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

  const households = inMemoryDb.listHouseholdsByUser(user.id);
  const primary = households[0] ?? null;

  const sharingGate = canUseHouseholdSharing(user.id);

  return ok({
    usage: usageMeter(user.id),
    sharing: sharingGate,
    household: primary,
    members: primary ? inMemoryDb.listMembersByHousehold(primary.id) : []
  });
}
