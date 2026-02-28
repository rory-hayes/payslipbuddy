import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { getSupabaseClient } from "@/lib/supabase/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
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

    const supabase = getSupabaseClient();
    if (!supabase) {
      return ok({
        mode: "mock",
        signedUrl: `/storage/mock/${file.bucket}/${file.path}`,
        expiresInSeconds: 300
      });
    }

    const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 300);
    if (error) {
      return serverError(error.message);
    }

    return ok({
      mode: "supabase",
      signedUrl: data.signedUrl,
      expiresInSeconds: 300
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to generate signed URL.");
  }
}
