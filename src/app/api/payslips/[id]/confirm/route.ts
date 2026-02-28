import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, ok, parseBody, serverError } from "@/lib/http";
import { validateParsedPayslip } from "@/lib/services/payslip-extraction";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { confirmPayslipBodySchema } from "@/lib/validation/schemas";
import type { ParsedPayslip } from "@/lib/types/domain";

const trackedFields: Array<keyof ParsedPayslip> = [
  "periodMonth",
  "periodYear",
  "employerName",
  "gross",
  "net",
  "tax",
  "pension",
  "niOrPrsi",
  "usc",
  "bonuses",
  "overtime"
];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const resolved = await resolveRequestUser({
      request,
      queryUserId: new URL(request.url).searchParams.get("userId")
    });
    if ("error" in resolved) {
      return resolved.error;
    }

    const payslip = inMemoryDb.getPayslip(id);
    if (!payslip) {
      return notFound("Payslip not found.");
    }

    if (payslip.userId !== resolved.data.userId) {
      return forbidden("Access denied for this payslip.");
    }

    inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const body = await parseBody(request, confirmPayslipBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const normalizedParsed: ParsedPayslip = {
      ...body.data.parsed,
      lineItems: body.data.parsed.lineItems ?? [],
      fieldConfidence: body.data.parsed.fieldConfidence ?? {},
      validationErrors: body.data.parsed.validationErrors ?? [],
      editedFields: body.data.parsed.editedFields ?? {}
    };

    const validationErrors = validateParsedPayslip(normalizedParsed);
    if (validationErrors.length > 0) {
      return badRequest("Cannot confirm payslip while validation errors exist.", {
        validationErrors
      });
    }

    const duplicate = inMemoryDb
      .listPayslipsByUser(payslip.userId)
      .find(
        (item) =>
          item.id !== payslip.id &&
          item.status === "CONFIRMED" &&
          item.employerId === payslip.employerId &&
          item.periodMonth === normalizedParsed.periodMonth &&
          item.periodYear === normalizedParsed.periodYear
      );

    if (duplicate && !body.data.replaceExisting) {
      return badRequest("Duplicate payslip period detected. Pass replaceExisting=true to replace intentionally.", {
        duplicatePayslipId: duplicate.id
      });
    }

    if (duplicate && body.data.replaceExisting) {
      duplicate.status = "FAILED";
      duplicate.notes = `Superseded by ${payslip.id} at ${new Date().toISOString()}`;
    }

    payslip.periodMonth = normalizedParsed.periodMonth;
    payslip.periodYear = normalizedParsed.periodYear;
    payslip.schemaVersion = normalizedParsed.schemaVersion;

    const draft = inMemoryDb.getExtractionDraft(payslip.id);
    const editedFields = { ...normalizedParsed.editedFields };
    if (draft) {
      trackedFields.forEach((field) => {
        if (draft.payload[field] !== normalizedParsed[field]) {
          editedFields[field] = true;
        }
      });
    }

    const parsedWithEdits: ParsedPayslip = {
      ...normalizedParsed,
      validationErrors,
      editedFields
    };

    inMemoryDb.setPayslipExtracted(payslip.id, body.data.confidence, body.data.notes ?? null);
    inMemoryDb.saveExtractionDraft({
      payslipId: payslip.id,
      payload: parsedWithEdits,
      confidence: body.data.confidence,
      notes: body.data.notes ?? null
    });
    inMemoryDb.saveBreakdown(payslip.id, parsedWithEdits);
    inMemoryDb.setPayslipConfirmed(payslip.id);
    inMemoryDb.addAuditLog({
      userId: payslip.userId,
      action: "PAYSLIP_CONFIRMED",
      entity: "payslip",
      entityId: payslip.id,
      metadata: { editedFields: parsedWithEdits.editedFields, confidence: body.data.confidence }
    });

    return ok({
      payslip: inMemoryDb.getPayslip(payslip.id),
      breakdown: inMemoryDb.getBreakdown(payslip.id)
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to confirm payslip.");
  }
}
