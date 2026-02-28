import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok } from "@/lib/http";

const acceptSchema = z.object({
  householdId: z.string().min(1),
  userId: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest("Invalid acceptance payload.", parsed.error.flatten());
  }

  const member = inMemoryDb.acceptHouseholdInvite(parsed.data.householdId, parsed.data.userId);

  if (!member) {
    return notFound("Invite not found.");
  }

  inMemoryDb.addAuditLog({
    userId: parsed.data.userId,
    action: "HOUSEHOLD_INVITE_ACCEPTED",
    entity: "household_member",
    entityId: `${member.householdId}:${member.userId}`
  });

  return ok({ member });
}
