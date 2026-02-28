import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok, serverError } from "@/lib/http";
import { resolveRequestUser } from "@/lib/supabase/request-user";

const onboardingSchema = z.object({
  userId: z.string().min(1),
  region: z.enum(["UK", "IE"]),
  householdName: z.string().min(1).max(80).optional(),
  employerName: z.string().min(1).max(100).optional(),
  reminderEnabled: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = onboardingSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid onboarding payload.", parsed.error.flatten());
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: parsed.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const hydrated = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const user = inMemoryDb.updateUserRegion(hydrated.id, parsed.data.region);
    if (!user) {
      return notFound("User not found.");
    }

    const households = inMemoryDb.listHouseholdsByUser(user.id);
    if (households[0] && parsed.data.householdName) {
      inMemoryDb.updateHouseholdName(households[0].id, parsed.data.householdName);
    }

    if (typeof parsed.data.reminderEnabled === "boolean") {
      inMemoryDb.setReminderEnabled(user.id, parsed.data.reminderEnabled);
    }

    if (parsed.data.employerName) {
      const employers = inMemoryDb.listEmployersByUser(user.id);
      const alreadyExists = employers.some(
        (employer) => employer.name.trim().toLowerCase() === parsed.data.employerName?.trim().toLowerCase()
      );

      if (!alreadyExists) {
        inMemoryDb.addEmployer({
          userId: user.id,
          name: parsed.data.employerName.trim()
        });
      }
    }

    return ok({
      user,
      household: households[0] ?? null,
      employers: inMemoryDb.listEmployersByUser(user.id)
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to complete onboarding.");
  }
}
