import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { canViewAnnualDashboard } from "@/lib/services/entitlements";
import { buildAnnualReport } from "@/lib/services/reporting";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const targetUserId = url.searchParams.get("targetUserId") ?? userId;
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

    if (!userId) {
      return badRequest("Missing query param userId.");
    }

    if (!Number.isInteger(year)) {
      return badRequest("Year must be an integer.");
    }

    const viewer = inMemoryDb.getUser(userId);
    if (!viewer) {
      return notFound("User not found.");
    }

    const gate = canViewAnnualDashboard(userId);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Annual dashboard unavailable.");
    }

    if (!targetUserId) {
      return notFound("Target user not found.");
    }

    if (targetUserId !== userId) {
      const shared = inMemoryDb
        .listHouseholdsByUser(userId)
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
