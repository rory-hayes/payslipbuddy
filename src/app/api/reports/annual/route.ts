import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { canViewAnnualDashboard } from "@/lib/services/entitlements";
import { buildAnnualReport } from "@/lib/services/reporting";
import { resolveRequestUser } from "@/lib/supabase/request-user";

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

    const viewer = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });
    const targetUserId = url.searchParams.get("targetUserId") ?? viewer.id;
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

    if (!Number.isInteger(year)) {
      return badRequest("Year must be an integer.");
    }

    const gate = canViewAnnualDashboard(viewer.id);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Annual dashboard unavailable.");
    }

    if (!targetUserId) {
      return notFound("Target user not found.");
    }

    if (targetUserId !== viewer.id) {
      const shared = inMemoryDb
        .listHouseholdsByUser(viewer.id)
        .some((household) => {
          if (household.ownerUserId === targetUserId) {
            return true;
          }
          if (household.ownerUserId === viewer.id) {
            return inMemoryDb
              .listMembersByHousehold(household.id)
              .some((member) => member.userId === targetUserId && member.status === "ACTIVE");
          }
          return false;
        });
      if (!shared) {
        return forbidden("Viewer does not have household access to target report.");
      }
    }

    const report = buildAnnualReport(targetUserId, year);
    return ok(report);
  } catch (error) {
    console.error(error);
    return serverError("Failed to generate annual report.");
  }
}
