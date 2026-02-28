import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 20);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 20;

  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const all = inMemoryDb.listPayslipsByUser(userId);
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
