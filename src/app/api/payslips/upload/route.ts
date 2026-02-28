import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, created, forbidden, notFound, parseBody, serverError } from "@/lib/http";
import { canUploadPayslip, canUseEmployer, consumePayslipUpload, usageMeter } from "@/lib/services/entitlements";
import { resolveRequestUser } from "@/lib/supabase/request-user";
import { uploadPayslipBodySchema } from "@/lib/validation/schemas";

const supportedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]);
const supportedExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);
const maxFileBytes = 10 * 1024 * 1024;

function extractExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(lastDot + 1).toLowerCase();
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return cleaned || "payslip";
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, uploadPayslipBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const resolved = await resolveRequestUser({
      request,
      bodyUserId: body.data.userId
    });
    if ("error" in resolved) {
      return resolved.error;
    }
    const user = inMemoryDb.ensureUser({
      id: resolved.data.userId,
      email: resolved.data.email
    });

    const entitlement = canUploadPayslip(user.id);
    if (!entitlement.allowed) {
      return forbidden(entitlement.reason ?? "Plan limit reached.");
    }

    const employerGate = canUseEmployer(user.id, body.data.employerId);
    if (!employerGate.allowed) {
      return forbidden(employerGate.reason ?? "Employer access is restricted by current plan.");
    }

    const employer = inMemoryDb.getEmployer(body.data.employerId);
    if (!employer || employer.userId !== user.id) {
      return notFound("Employer not found for user.");
    }

    if (!supportedMimeTypes.has(body.data.mimeType.toLowerCase())) {
      return badRequest("Unsupported file type. Upload PDF, PNG, JPG, or WEBP payslips.");
    }

    const extension = extractExtension(body.data.fileName);
    if (!supportedExtensions.has(extension)) {
      return badRequest("Invalid file extension. Upload PDF, PNG, JPG, or WEBP payslips.");
    }

    if (body.data.fileSizeBytes && body.data.fileSizeBytes > maxFileBytes) {
      return badRequest("File size exceeds the 10MB limit.");
    }

    const now = new Date();
    const safeFileName = sanitizeFileName(body.data.fileName);
    const generatedPath = `uploads/${user.id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}-${safeFileName}`;
    const file = inMemoryDb.addFile({
      userId: user.id,
      bucket: "payslips",
      path: generatedPath,
      mimeType: body.data.mimeType.toLowerCase(),
      encrypted: true
    });

    const payslip = inMemoryDb.addPayslip({
      userId: user.id,
      employerId: body.data.employerId,
      sourceFileId: file.id,
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear(),
      schemaVersion: user.region === "UK" ? "UK_v1" : "IE_v1"
    });

    consumePayslipUpload(user.id);
    const meter = usageMeter(user.id);
    inMemoryDb.addAuditLog({
      userId: user.id,
      action: "PAYSLIP_UPLOADED",
      entity: "payslip",
      entityId: payslip.id,
      metadata: {
        fileId: file.id,
        schemaVersion: payslip.schemaVersion,
        fileName: safeFileName,
        fileSizeBytes: body.data.fileSizeBytes ?? null
      }
    });

    return created({
      payslip,
      file,
      usage: meter
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to upload payslip.");
  }
}
