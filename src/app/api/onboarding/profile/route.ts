import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, notFound, ok, serverError } from "@/lib/http";

const onboardingSchema = z.object({
  userId: z.string().min(1),
  region: z.enum(["UK", "IE"]),
  householdName: z.string().min(1).max(80).optional()
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = onboardingSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid onboarding payload.", parsed.error.flatten());
    }

    const user = inMemoryDb.updateUserRegion(parsed.data.userId, parsed.data.region);
    if (!user) {
      return notFound("User not found.");
    }

    const households = inMemoryDb.listHouseholdsByUser(user.id);
    if (households[0] && parsed.data.householdName) {
      inMemoryDb.updateHouseholdName(households[0].id, parsed.data.householdName);
    }

    return ok({
      user,
      household: households[0] ?? null
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to complete onboarding.");
  }
}
