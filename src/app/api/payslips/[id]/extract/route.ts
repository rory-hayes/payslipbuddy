import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/http";
import { enqueueJob, processJob } from "@/lib/services/jobs";
import { extractPayslip } from "@/lib/services/payslip-extraction";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payslip = inMemoryDb.getPayslip(id);

    if (!payslip) {
      return notFound("Payslip not found.");
    }

    const user = inMemoryDb.getUser(payslip.userId);
    if (!user) {
      return notFound("User not found.");
    }

    const file = inMemoryDb.getFile(payslip.sourceFileId);
    if (!file) {
      return notFound("Source file not found.");
    }

    let manualRawJson: unknown;
    try {
      const payload = await request.json();
      if (payload && typeof payload === "object" && "rawExtraction" in payload) {
        manualRawJson = payload.rawExtraction;
      }
    } catch {
      manualRawJson = undefined;
    }

    const job = enqueueJob("extraction", { payslipId: payslip.id, userId: user.id });
    const extraction = await processJob(job, () =>
      extractPayslip(
        {
          filePath: file.path,
          mimeType: file.mimeType,
          region: user.region
        },
        manualRawJson
      )
    );

    inMemoryDb.setPayslipExtracted(payslip.id, extraction.confidence, extraction.notes);
    inMemoryDb.saveExtractionDraft({
      payslipId: payslip.id,
      payload: extraction.parsed,
      confidence: extraction.confidence,
      notes: extraction.notes
    });
    inMemoryDb.addAuditLog({
      userId: user.id,
      action: "PAYSLIP_EXTRACTED",
      entity: "payslip",
      entityId: payslip.id,
      metadata: { jobId: job.id, confidence: extraction.confidence, validationErrors: extraction.parsed.validationErrors }
    });

    return ok({
      jobId: job.id,
      payslipId: payslip.id,
      status: "EXTRACTED",
      confidence: extraction.confidence,
      notes: extraction.notes,
      parsed: extraction.parsed
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to extract payslip data.");
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const userId = new URL(request.url).searchParams.get("userId");

    if (!userId) {
      return badRequest("Missing query param userId.");
    }

    const payslip = inMemoryDb.getPayslip(id);
    if (!payslip) {
      return notFound("Payslip not found.");
    }

    if (payslip.userId !== userId) {
      return forbidden("Access denied for this payslip.");
    }

    const draft = inMemoryDb.getExtractionDraft(id);
    if (!draft) {
      return notFound("No extraction draft found for this payslip.");
    }

    return ok({
      payslipId: id,
      status: payslip.status,
      confidence: draft.confidence,
      notes: draft.notes,
      parsed: draft.payload
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to load extraction draft.");
  }
}
