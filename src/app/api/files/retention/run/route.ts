import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok, serverError } from "@/lib/http";

const retentionSchema = z.object({
  userId: z.string().min(1),
  retentionDays: z.number().int().min(1).max(365).default(30)
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = retentionSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid retention payload.", parsed.error.flatten());
    }

    const files = inMemoryDb.listFilesByUser(parsed.data.userId);
    const cutoff = Date.now() - parsed.data.retentionDays * 24 * 60 * 60 * 1000;

    let deleted = 0;
    files.forEach((file) => {
      if (new Date(file.createdAt).getTime() < cutoff) {
        if (inMemoryDb.deleteFile(file.id)) {
          deleted += 1;
        }
      }
    });

    return ok({
      userId: parsed.data.userId,
      retentionDays: parsed.data.retentionDays,
      deleted
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to run retention cleanup.");
  }
}
