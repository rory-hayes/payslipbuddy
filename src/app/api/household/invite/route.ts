import { inMemoryDb } from "@/lib/db/in-memory-db";
import { created, forbidden, notFound, ok, parseBody, serverError } from "@/lib/http";
import { canUseHouseholdSharing } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { inviteHouseholdBodySchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, inviteHouseholdBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: body.data.invitedBy
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const inviter = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const household = inMemoryDb.getHousehold(body.data.householdId);
    if (!household) {
      return notFound("Household not found.");
    }

    if (household.ownerUserId !== inviter.id) {
      return forbidden("Only the household owner can invite members.");
    }

    const gate = canUseHouseholdSharing(inviter.id);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Household sharing unavailable for current plan.");
    }

    const role = body.data.role ?? "MEMBER";
    const inviteResult = inMemoryDb.inviteToHousehold(body.data.householdId, body.data.email, role);
    const invite = inviteResult.member;

    if (inviteResult.created) {
      inMemoryDb.addAuditLog({
        userId: inviter.id,
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
