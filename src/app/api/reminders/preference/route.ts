import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok, serverError } from "@/lib/http";

const reminderSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return badRequest("Missing query param userId.");
  }

  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return notFound("User not found.");
  }

  return ok({ userId, enabled: user.reminderEnabled });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = reminderSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid reminder payload.", parsed.error.flatten());
    }

    const user = inMemoryDb.setReminderEnabled(parsed.data.userId, parsed.data.enabled);
    if (!user) {
      return notFound("User not found.");
    }
    return ok({ userId: user.id, enabled: user.reminderEnabled });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update reminder preference.");
  }
}
