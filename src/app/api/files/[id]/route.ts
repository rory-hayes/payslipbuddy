import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok } from "@/lib/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const { id } = await context.params;
  const file = inMemoryDb.getFile(id);
  if (!file) {
    return notFound("File not found.");
  }

  if (file.userId !== userId) {
    return forbidden("Access denied for this file.");
  }

  inMemoryDb.deleteFile(file.id);
  return ok({ deleted: true, fileId: file.id });
}
