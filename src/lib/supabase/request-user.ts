import { badRequest, forbidden } from "@/lib/http";
import { getAuthenticatedRequestUser } from "@/lib/supabase/auth-server";

export interface RequestUserContext {
  userId: string;
  email: string | null;
  authenticated: boolean;
}

interface ResolveRequestUserInput {
  request: Request;
  queryUserId?: string | null;
  bodyUserId?: string | null;
}

export async function resolveRequestUser(
  input: ResolveRequestUserInput
): Promise<{ data: RequestUserContext } | { error: Response }> {
  const authenticated = await getAuthenticatedRequestUser(input.request);

  if (authenticated) {
    if (input.queryUserId && input.queryUserId !== authenticated.id) {
      return { error: forbidden("Authenticated user does not match requested user.") };
    }

    if (input.bodyUserId && input.bodyUserId !== authenticated.id) {
      return { error: forbidden("Authenticated user does not match payload user.") };
    }

    return {
      data: {
        userId: authenticated.id,
        email: authenticated.email,
        authenticated: true
      }
    };
  }

  const fallbackUserId = input.bodyUserId ?? input.queryUserId;
  if (!fallbackUserId) {
    return { error: badRequest("Missing user identifier.") };
  }

  return {
    data: {
      userId: fallbackUserId,
      email: null,
      authenticated: false
    }
  };
}
