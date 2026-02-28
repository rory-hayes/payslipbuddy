import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, created, ok, serverError } from "@/lib/http";
import { resolveRequestUser } from "@/lib/supabase/request-user";

const createEmployerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  taxRef: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const resolved = await resolveRequestUser({
    request,
    queryUserId: new URL(request.url).searchParams.get("userId")
  });
  if ("error" in resolved) {
    return resolved.error;
  }

  const user = inMemoryDb.ensureUser({
    id: resolved.data.userId,
    email: resolved.data.email
  });

  return ok({ employers: inMemoryDb.listEmployersByUser(user.id) });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createEmployerSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest("Invalid employer payload.", parsed.error.flatten());
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: parsed.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }
    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const duplicate = inMemoryDb
      .listEmployersByUser(user.id)
      .some((employer) => employer.name.toLowerCase() === parsed.data.name.toLowerCase());
    if (duplicate) {
      return badRequest("Employer with this name already exists.");
    }

    const employer = inMemoryDb.addEmployer({
      userId: user.id,
      name: parsed.data.name,
      taxRef: parsed.data.taxRef ?? undefined
    });

    inMemoryDb.addAuditLog({
      userId: user.id,
      action: "EMPLOYER_CREATED",
      entity: "employer",
      entityId: employer.id,
      metadata: { name: employer.name }
    });

    return created({ employer });
  } catch (error) {
    console.error(error);
    return serverError("Failed to create employer.");
  }
}
