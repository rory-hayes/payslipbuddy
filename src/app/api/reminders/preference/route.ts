import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok, serverError } from "@/lib/http";
import { resolveRequestUser } from "@/lib/supabase/request-user";

const reminderSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveRequestUser({
    request,
    queryUserId: url.searchParams.get("userId")
  });
  if ("error" in resolved) {
    return resolved.error;
  }

  const user = inMemoryDb.ensureUser({
    id: resolved.data.userId,
    email: resolved.data.email
  });

  return ok({ userId: user.id, enabled: user.reminderEnabled });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = reminderSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid reminder payload.", parsed.error.flatten());
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: parsed.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const user = inMemoryDb.setReminderEnabled(resolved.data.userId, parsed.data.enabled);
    if (!user) {
      return badRequest("User reminder settings could not be updated.");
    }
    return ok({ userId: user.id, enabled: user.reminderEnabled });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update reminder preference.");
  }
}
