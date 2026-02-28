import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok } from "@/lib/http";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  return ok({ logs: inMemoryDb.listAuditLogs(userId) });
}
