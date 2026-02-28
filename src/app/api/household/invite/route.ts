import { inMemoryDb } from "@/lib/db/in-memory-db";
import { created, forbidden, notFound, ok, parseBody, serverError } from "@/lib/http";
import { canUseHouseholdSharing } from "@/lib/services/entitlements";
import { inviteHouseholdBodySchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, inviteHouseholdBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const household = inMemoryDb.getHousehold(body.data.householdId);
    if (!household) {
      return notFound("Household not found.");
    }

    if (household.ownerUserId !== body.data.invitedBy) {
      return forbidden("Only the household owner can invite members.");
    }

    const gate = canUseHouseholdSharing(body.data.invitedBy);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Household sharing unavailable for current plan.");
    }

    const role = body.data.role ?? "MEMBER";
    const inviteResult = inMemoryDb.inviteToHousehold(body.data.householdId, body.data.email, role);
    const invite = inviteResult.member;

    if (inviteResult.created) {
      inMemoryDb.addAuditLog({
        userId: body.data.invitedBy,
        action: "HOUSEHOLD_INVITE_CREATED",
        entity: "household_member",
        entityId: `${invite.householdId}:${invite.userId}`,
        metadata: { email: body.data.email, role }
      });

      return created({
        invite,
        message: "Invite created. Plug an email provider here to send secure invite links."
      });
    }

    return ok({
      invite,
      message: "Invite already exists for this member email."
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to invite household member.");
  }
}
