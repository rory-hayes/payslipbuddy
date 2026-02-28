import { z } from "zod";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, serverError } from "@/lib/http";
import { canExportAnnual } from "@/lib/services/entitlements";
import { enqueueJob, processJob } from "@/lib/services/jobs";
import { annualReportToPdf, annualReportToWorkbook, buildAnnualReport } from "@/lib/services/reporting";
import { resolveRequestUser } from "@/lib/supabase/request-user";

const exportSchema = z.object({
  userId: z.string().min(1),
  targetUserId: z.string().min(1).optional(),
  year: z.number().int().min(2000).max(2100),
  format: z.enum(["pdf", "xlsx"])
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = exportSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid export payload.", parsed.error.flatten());
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: parsed.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const viewer = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });
    const targetUserId = parsed.data.targetUserId ?? viewer.id;
    const gate = canExportAnnual(viewer.id, parsed.data.format);
    if (!gate.allowed) {
      return forbidden(gate.reason ?? "Export blocked for current plan.");
    }

    if (targetUserId !== viewer.id) {
      const shared = inMemoryDb
        .listHouseholdsByUser(viewer.id)
        .some((household) => {
          if (household.ownerUserId === targetUserId) {
            return true;
          }
          if (household.ownerUserId === viewer.id) {
            return inMemoryDb
              .listMembersByHousehold(household.id)
              .some((member) => member.userId === targetUserId && member.status === "ACTIVE");
          }
          return false;
        });

      if (!shared) {
        return forbidden("Viewer does not have household access to target export.");
      }
    }

    const report = buildAnnualReport(targetUserId, parsed.data.year);
    const job = enqueueJob("annual_report_export", {
      userId: viewer.id,
      targetUserId,
      year: parsed.data.year,
      format: parsed.data.format
    });

    if (parsed.data.format === "xlsx") {
      const file = await processJob(job, async () => annualReportToWorkbook(report));
      return new Response(new Uint8Array(file), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"payslip-report-${report.year}.xlsx\"`,
          "x-job-id": job.id
        }
      });
    }

    const file = await processJob(job, async () => annualReportToPdf(report));
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"payslip-report-${report.year}.pdf\"`,
        "x-job-id": job.id
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to export annual report.");
  }
}
