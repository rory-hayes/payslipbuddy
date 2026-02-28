import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok, serverError } from "@/lib/http";
import { getAuthenticatedRequestUser } from "@/lib/supabase/auth-server";

const fallbackSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional()
  })
  .optional();

export async function POST(request: Request) {
  try {
    const authenticated = await getAuthenticatedRequestUser(request);

    const fallbackPayload = (await request.json().catch(() => ({}))) as unknown;
    const parsedFallback = fallbackSchema.safeParse(fallbackPayload);

    if (!parsedFallback.success) {
      return badRequest("Invalid auth bootstrap payload.", parsedFallback.error.flatten());
    }

    const userId = authenticated?.id ?? parsedFallback.data?.userId;
    const email = authenticated?.email ?? parsedFallback.data?.email ?? null;

    if (!userId) {
      return badRequest("Could not resolve a user id for bootstrap.");
    }

    const user = inMemoryDb.ensureUser({
      id: userId,
      email
    });

    const household = inMemoryDb.listHouseholdsByUser(user.id)[0] ?? null;

    inMemoryDb.addAuditLog({
      userId: user.id,
      action: "AUTH_BOOTSTRAP",
      entity: "user_profile",
      entityId: user.id,
      metadata: { authenticated: Boolean(authenticated) }
    });

    return ok({
      user,
      household
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to bootstrap authenticated workspace.");
  }
}
