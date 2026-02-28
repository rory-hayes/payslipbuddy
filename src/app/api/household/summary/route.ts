import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok } from "@/lib/http";
import { canUseHouseholdSharing, usageMeter } from "@/lib/services/entitlements";

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

  const households = inMemoryDb.listHouseholdsByUser(userId);
  const primary = households[0] ?? null;

  const sharingGate = canUseHouseholdSharing(userId);

  return ok({
    usage: usageMeter(userId),
    sharing: sharingGate,
    household: primary,
    members: primary ? inMemoryDb.listMembersByHousehold(primary.id) : []
  });
}
