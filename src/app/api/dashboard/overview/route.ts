import { badRequest, notFound, ok } from "@/lib/http";
import { getDashboardOverview } from "@/lib/services/dashboard";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const overview = getDashboardOverview(userId);
  if (!overview) {
    return notFound("User not found.");
  }

  return ok(overview);
}
