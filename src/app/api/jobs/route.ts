import { badRequest, ok } from "@/lib/http";
import { listJobs } from "@/lib/services/jobs";

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") as "extraction" | "annual_report_export" | "monthly_reminder" | null;
  if (type && !["extraction", "annual_report_export", "monthly_reminder"].includes(type)) {
    return badRequest("Invalid type query param.");
  }

  return ok({ jobs: listJobs(type ?? undefined) });
}
