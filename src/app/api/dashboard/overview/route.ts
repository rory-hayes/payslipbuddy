import { ok } from "@/lib/http";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { getDashboardOverview } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveRequestUser({
    request,
    queryUserId: url.searchParams.get("userId")
  });
  if ("error" in resolved) {
    return resolved.error;
  }

  const overview = getDashboardOverview(resolved.data.userId);

  return ok(overview);
}
