import { inMemoryDb } from "@/lib/db/in-memory-db";
import { ok } from "@/lib/http";
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
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 20);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 20;

  inMemoryDb.ensureUser({
    id: resolved.data.userId,
    email: resolved.data.email
  });

  const all = inMemoryDb.listPayslipsByUser(resolved.data.userId);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const rows = all.slice(start, end).map((payslip) => ({
    ...payslip,
    breakdown: inMemoryDb.getBreakdown(payslip.id)
  }));

  return ok({
    rows,
    page,
    pageSize,
    total: all.length
  });
}
