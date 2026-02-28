"use client";

import { type ChangeEvent, type DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Subheading } from "@/components/catalyst/heading";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { Text } from "@/components/catalyst/text";
import { Textarea } from "@/components/catalyst/textarea";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";
import type { ParsedPayslip } from "@/lib/types/domain";

interface UploadedPayload {
  payslip: { id: string; status: string };
  usage: {
    plan: string;
    subscriptionStatus: string;
    freePayslipsUsed: number;
    freePayslipsLimit: number;
    unlimitedPayslips: boolean;
  } | null;
}

interface ExtractPayload {
  payslipId: string;
  confidence: number;
  notes: string | null;
  parsed: ParsedPayslip;
}

interface ExtractDraftPayload extends ExtractPayload {
  status: string;
}

interface PayslipListRow {
  id: string;
  status: string;
  schemaVersion: string;
  periodMonth: number;
  periodYear: number;
  breakdown: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    validationErrors: string[];
    fieldConfidence: Record<string, number>;
  } | null;
}

interface PayslipListResponse {
  rows: PayslipListRow[];
  total: number;
}

interface EmployerRow {
  id: string;
  name: string;
}

function createEmptyParsed(region: "UK" | "IE"): ParsedPayslip {
  return {
    schemaVersion: region === "IE" ? "IE_v1" : "UK_v1",
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    employerName: "",
    gross: 0,
    net: 0,
    tax: 0,
    pension: 0,
    niOrPrsi: 0,
    usc: 0,
    bonuses: 0,
    overtime: 0,
    lineItems: [],
    fieldConfidence: {},
    validationErrors: [],
    editedFields: {}
  };
}

const acceptedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
const acceptedExtensions = ["pdf", "png", "jpg", "jpeg", "webp"] as const;
const maxUploadBytes = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  const value = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return value;
}

function extensionFromFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(lastDot + 1).toLowerCase();
}

function inferMimeType(file: File) {
  const normalizedType = file.type.toLowerCase();
  if (acceptedMimeTypes.includes(normalizedType as (typeof acceptedMimeTypes)[number])) {
    return normalizedType;
  }

  const extension = extensionFromFileName(file.name);
  if (extension === "pdf") {
    return "application/pdf";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }

  return normalizedType;
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return cleaned || "payslip.pdf";
}

function buildStoragePath(userId: string, fileName: string) {
  const now = new Date();
  const safeName = sanitizeFileName(fileName);
  return `uploads/${userId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}-${safeName}`;
}

export default function PayslipsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [activePayslipId, setActivePayslipId] = useState("");
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [employerId, setEmployerId] = useState("");
  const [newEmployerName, setNewEmployerName] = useState("Side Gig Ltd");
  const [draft, setDraft] = useState<ParsedPayslip>(createEmptyParsed("UK"));
  const [confidence, setConfidence] = useState(0.8);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rows, setRows] = useState<PayslipListRow[]>([]);
  const [loadingDraftId, setLoadingDraftId] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [extractBusy, setExtractBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const requiredErrors = useMemo(() => {
    const errors: string[] = [];
    const requiredBase = [draft.gross, draft.net, draft.tax, draft.pension, draft.niOrPrsi, draft.periodMonth, draft.periodYear];
    if (requiredBase.some((value) => value === null || value === undefined || Number.isNaN(value))) {
      errors.push("Missing required payroll fields.");
    }
    if (!draft.employerName) {
      errors.push("employerName is required.");
    }
    if (draft.schemaVersion === "IE_v1" && (draft.usc === null || draft.usc === undefined || Number.isNaN(draft.usc))) {
      errors.push("usc is required for IE_v1.");
    }
    if (draft.net > draft.gross) {
      errors.push("net cannot exceed gross.");
    }
    if (draft.validationErrors.length > 0) {
      errors.push(...draft.validationErrors);
    }
    return Array.from(new Set(errors));
  }, [draft]);

  const hasEmployer = Boolean(employerId || employers[0]?.id);

  const resetReviewState = useCallback((nextRegion: "UK" | "IE" = region) => {
    setActivePayslipId("");
    setDraft(createEmptyParsed(nextRegion));
    setConfidence(0.8);
    setNotes("");
    setSelectedFile(null);
    setIsDropTargetActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [region]);

  function setCandidateFile(file: File | null) {
    setSuccessMessage("");
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = extensionFromFileName(file.name);
    if (!acceptedExtensions.includes(extension as (typeof acceptedExtensions)[number])) {
      setMessage("Unsupported file extension. Please upload PDF, PNG, JPG, or WEBP.");
      setSelectedFile(null);
      return;
    }

    const normalizedMimeType = inferMimeType(file);
    if (!acceptedMimeTypes.includes(normalizedMimeType as (typeof acceptedMimeTypes)[number])) {
      setMessage("Unsupported file type. Please upload PDF, PNG, JPG, or WEBP.");
      setSelectedFile(null);
      return;
    }

    if (file.size > maxUploadBytes) {
      setMessage("File too large. Please upload a file that is 10MB or smaller.");
      setSelectedFile(null);
      return;
    }

    setMessage("");
    setSelectedFile(file);
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    setCandidateFile(event.target.files?.[0] ?? null);
  }

  function onDropTargetDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDropTargetActive(true);
  }

  function onDropTargetDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);
  }

  function onDropTargetDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);
    setCandidateFile(event.dataTransfer.files?.[0] ?? null);
  }

  function fieldConfidenceValue(field: keyof ParsedPayslip) {
    const value = draft.fieldConfidence[field as string];
    return typeof value === "number" ? value : null;
  }

  function confidenceBadgeColor(value: number | null) {
    if (value === null) {
      return null;
    }
    if (value < 0.75) {
      return "amber" as const;
    }
    if (value < 0.9) {
      return "blue" as const;
    }
    return "emerald" as const;
  }

  function renderFieldTags(field: keyof ParsedPayslip) {
    const confidenceValue = fieldConfidenceValue(field);
    const color = confidenceBadgeColor(confidenceValue);
    const wasEdited = Boolean(draft.editedFields[field as string]);

    if (confidenceValue === null && !wasEdited) {
      return null;
    }

    return (
      <span className="flex items-center gap-1">
        {confidenceValue !== null && color ? <Badge color={color}>{Math.round(confidenceValue * 100)}%</Badge> : null}
        {wasEdited ? <Badge color="zinc">Edited</Badge> : null}
      </span>
    );
  }

  const refreshList = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const result = await apiFetch<PayslipListResponse>(`/api/payslips?userId=${user.id}`);
    if (result.ok && result.data) {
      setRows(result.data.rows);
    }
  }, [user?.id]);

  const refreshEmployers = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const result = await apiFetch<{ employers: EmployerRow[] }>(`/api/employers?userId=${user.id}`);
    if (result.ok && result.data) {
      setEmployers(result.data.employers);
      if (!employerId && result.data.employers[0]) {
        setEmployerId(result.data.employers[0].id);
      }
    }
  }, [employerId, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void refreshList();
    void refreshEmployers();
    apiFetch<{ user: { region: "UK" | "IE" } }>(`/api/billing/summary?userId=${user.id}`).then((result) => {
      if (!result.ok || !result.data) {
        return;
      }

      const nextRegion = result.data.user.region;
      setRegion(nextRegion);
      setDraft((prev) => {
        const schemaVersion = nextRegion === "IE" ? "IE_v1" : "UK_v1";
        if (prev.schemaVersion === schemaVersion) {
          return prev;
        }

        return {
          ...createEmptyParsed(nextRegion),
          periodMonth: prev.periodMonth,
          periodYear: prev.periodYear
        };
      });
    });
  }, [refreshList, refreshEmployers, user?.id]);

  const loadExtractedDraft = useCallback(async (payslipId: string, silent = false) => {
    if (!user?.id) {
      return;
    }

    setLoadingDraftId(payslipId);

    const result = await apiFetch<ExtractDraftPayload>(`/api/payslips/${payslipId}/extract?userId=${user.id}`);
    setLoadingDraftId("");

    if (!result.ok || !result.data) {
      if (!silent) {
        setMessage(result.error?.message ?? "Could not load extraction draft.");
      }
      return;
    }

    setActivePayslipId(payslipId);
    setDraft(result.data.parsed);
    setConfidence(result.data.confidence);
    setNotes(result.data.notes ?? "");
    setSuccessMessage("");
    if (!silent) {
      setMessage(`Loaded review draft for payslip ${payslipId}.`);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activePayslipId || rows.length === 0) {
      return;
    }

    const latestExtracted = rows.find((row) => row.status === "EXTRACTED");
    if (latestExtracted) {
      void loadExtractedDraft(latestExtracted.id, true);
    }
  }, [rows, activePayslipId, loadExtractedDraft]);

  useEffect(() => {
    if (!activePayslipId) {
      return;
    }

    const activeRow = rows.find((row) => row.id === activePayslipId);
    if (activeRow?.status !== "CONFIRMED") {
      return;
    }

    setMessage("");
    setSuccessMessage("Payslip confirmed and saved to history. The review form has been cleared.");
    resetReviewState(region);
  }, [activePayslipId, region, resetReviewState, rows]);

  async function uploadAndExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccessMessage("");
    const selectedEmployerId = employerId || employers[0]?.id;
    if (!selectedEmployerId) {
      setMessage("Create an employer before uploading.");
      return;
    }

    if (!user?.id) {
      setMessage("Sign in to upload payslips.");
      return;
    }

    if (!selectedFile) {
      setMessage("Select a payslip file first.");
      return;
    }

    const normalizedMimeType = inferMimeType(selectedFile);
    if (!acceptedMimeTypes.includes(normalizedMimeType as (typeof acceptedMimeTypes)[number])) {
      setMessage("Unsupported file type. Please upload PDF, PNG, JPG, or WEBP.");
      return;
    }

    if (selectedFile.size > maxUploadBytes) {
      setMessage("File too large. Please upload a file that is 10MB or smaller.");
      return;
    }

    setUploadBusy(true);

    const upload = await apiFetch<UploadedPayload>("/api/payslips/upload", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        employerId: selectedEmployerId,
        fileName: selectedFile.name,
        mimeType: normalizedMimeType,
        storagePath: buildStoragePath(user.id, selectedFile.name),
        fileSizeBytes: selectedFile.size
      })
    });
    setUploadBusy(false);

    if (!upload.ok || !upload.data) {
      setMessage(upload.error?.message ?? "Upload failed.");
      return;
    }

    const payslipId = upload.data.payslip.id;
    setActivePayslipId(payslipId);
    setExtractBusy(true);

    const extract = await apiFetch<ExtractPayload>(`/api/payslips/${payslipId}/extract?userId=${user.id}`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setExtractBusy(false);

    if (!extract.ok || !extract.data) {
      setMessage(extract.error?.message ?? "Extraction failed.");
      return;
    }

    setDraft(extract.data.parsed);
    setConfidence(extract.data.confidence);
    setNotes(extract.data.notes ?? "");
    const usage = upload.data.usage;
    const usageLine = usage?.unlimitedPayslips
      ? `Unlimited payslips on ${usage.plan}.`
      : `${usage?.freePayslipsUsed ?? 0}/${usage?.freePayslipsLimit ?? 1} free payslips.`;
    setMessage(`Extracted "${selectedFile.name}" with confidence ${(extract.data.confidence * 100).toFixed(0)}%. Usage: ${usageLine}`);
    await refreshList();
  }

  async function createEmployer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");
    if (!user?.id) {
      setMessage("Sign in to add employers.");
      return;
    }

    const result = await apiFetch<{ employer: EmployerRow }>("/api/employers", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        name: newEmployerName
      })
    });

    if (!result.ok || !result.data) {
      setMessage(result.error?.message ?? "Failed to create employer.");
      return;
    }

    setMessage(`Employer created: ${result.data.employer.name}`);
    setNewEmployerName("");
    await refreshEmployers();
    setEmployerId(result.data.employer.id);
  }

  async function confirmDraft() {
    setSuccessMessage("");
    if (!activePayslipId) {
      setMessage("Upload and extract a payslip first.");
      return;
    }
    if (!user?.id) {
      setMessage("Sign in to confirm payslips.");
      return;
    }

    const confirm = await apiFetch<{ payslip: { id: string; status: string } }>(
      `/api/payslips/${activePayslipId}/confirm?userId=${user.id}`,
      {
        method: "POST",
        body: JSON.stringify({
          parsed: draft,
          confidence,
          notes,
          replaceExisting: true
        })
      }
    );

    if (!confirm.ok || !confirm.data) {
      setMessage(confirm.error?.message ?? "Failed to confirm payslip.");
      return;
    }

    setMessage("");
    setSuccessMessage("Payslip confirmed and saved to history. The review form has been cleared.");
    resetReviewState(region);
    await refreshList();
  }

  function updateField<K extends keyof ParsedPayslip>(field: K, value: ParsedPayslip[K]) {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
      editedFields: {
        ...prev.editedFields,
        [field]: true
      }
    }));
  }

  if (authLoading) {
    return <Text>Loading payslip workspace...</Text>;
  }

  return (
    <PageShell
      title="Payslips"
      subtitle="Upload a payslip, review AI extraction with field-level confidence, then confirm only when required fields validate."
    >
      <div className="flex items-center gap-2">
        <Badge color="blue">Region: {region}</Badge>
        <Badge color="zinc">Schema: {draft.schemaVersion}</Badge>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
          {message}
        </div>
      ) : null}

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Upload and Extract</Subheading>
          <Text className="mt-2">Drop a payslip file or browse your device. We extract first, then you can manually edit any field before confirmation.</Text>

          <form onSubmit={uploadAndExtract} className="mt-4 space-y-4">
            <label
              htmlFor="payslip-file-input"
              className={`block cursor-pointer rounded-xl border-2 border-dashed p-5 transition ${
                isDropTargetActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-zinc-500"
              }`}
              onDragOver={onDropTargetDragOver}
              onDragLeave={onDropTargetDragLeave}
              onDrop={onDropTargetDrop}
            >
              <input
                id="payslip-file-input"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                onChange={onFileInputChange}
              />
              <div className="flex items-start gap-3">
                <ArrowUpTrayIcon className="mt-0.5 size-5 text-zinc-500 dark:text-zinc-300" />
                <div className="space-y-1">
                  <Text className="font-medium text-zinc-950 dark:text-white">Drag and drop payslip file</Text>
                  <Text>or click to browse.</Text>
                  <Text className="text-xs">Accepted: PDF, PNG, JPG, WEBP. Max 10MB.</Text>
                </div>
              </div>
            </label>

            <div className="rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <DocumentTextIcon className="mt-0.5 size-5 text-zinc-500 dark:text-zinc-300" />
                  <div>
                    <Text className="font-medium text-zinc-950 dark:text-white">
                      {selectedFile ? selectedFile.name : "No file selected yet"}
                    </Text>
                    <Text className="text-xs">
                      {selectedFile ? `${formatBytes(selectedFile.size)} • ${inferMimeType(selectedFile)}` : "Choose a file to begin extraction."}
                    </Text>
                  </div>
                </div>
                {selectedFile ? (
                  <Button
                    type="button"
                    plain
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            <label className="space-y-2">
              <Text>Employer</Text>
              <Select value={employerId} onChange={(event) => setEmployerId(event.target.value)}>
                {employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>
                    {employer.name}
                  </option>
                ))}
              </Select>
            </label>

            <Button type="submit" disabled={!selectedFile || !hasEmployer || uploadBusy || extractBusy}>
              {uploadBusy ? "Uploading..." : extractBusy ? "Extracting..." : "Upload + Extract"}
            </Button>
          </form>

          <form onSubmit={createEmployer} className="mt-4 flex gap-2">
            <Input
              value={newEmployerName}
              onChange={(event) => setNewEmployerName(event.target.value)}
              className="w-full"
              placeholder="Create another employer"
            />
            <Button type="submit" outline>
              Add
            </Button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Review Before Save</Subheading>
          <Text className="mt-2">Fields with lower confidence are highlighted in amber. Confirm only after checking those values.</Text>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Employer Name</Text>
                {renderFieldTags("employerName")}
              </span>
              <Input value={draft.employerName} onChange={(event) => updateField("employerName", event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Month</Text>
                {renderFieldTags("periodMonth")}
              </span>
              <Input value={draft.periodMonth} onChange={(event) => updateField("periodMonth", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Year</Text>
                {renderFieldTags("periodYear")}
              </span>
              <Input value={draft.periodYear} onChange={(event) => updateField("periodYear", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Gross</Text>
                {renderFieldTags("gross")}
              </span>
              <Input value={draft.gross} onChange={(event) => updateField("gross", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Net</Text>
                {renderFieldTags("net")}
              </span>
              <Input value={draft.net} onChange={(event) => updateField("net", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Tax</Text>
                {renderFieldTags("tax")}
              </span>
              <Input value={draft.tax} onChange={(event) => updateField("tax", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>Pension</Text>
                {renderFieldTags("pension")}
              </span>
              <Input value={draft.pension} onChange={(event) => updateField("pension", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>NI / PRSI</Text>
                {renderFieldTags("niOrPrsi")}
              </span>
              <Input value={draft.niOrPrsi} onChange={(event) => updateField("niOrPrsi", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2">
                <Text>USC</Text>
                {renderFieldTags("usc")}
              </span>
              <Input value={draft.usc ?? 0} onChange={(event) => updateField("usc", Number(event.target.value))} type="number" />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <Text className="font-medium text-zinc-950 dark:text-white">Model confidence</Text>
              <Badge color={confidenceBadgeColor(confidence) ?? "zinc"}>{Math.round(confidence * 100)}%</Badge>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">Review notes and field confidence</summary>
              <label className="mt-3 block space-y-2">
                <Text>Reviewer Notes</Text>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="h-20" />
              </label>

              {Object.keys(draft.fieldConfidence).length > 0 ? (
                <div className="mt-3 rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
                  <Text className="font-medium text-zinc-950 dark:text-white">Field Confidence</Text>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(draft.fieldConfidence).map(([field, value]) => (
                      <li key={field} className="text-sm/6 text-zinc-700 dark:text-zinc-300">
                        {field}: {(value * 100).toFixed(0)}%
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </details>
          </div>

          {requiredErrors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">Resolve validation errors before confirm</p>
              <ul className="mt-2 space-y-1">
                {requiredErrors.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5">
            <Button onClick={confirmDraft} disabled={!activePayslipId || requiredErrors.length > 0 || uploadBusy || extractBusy} type="button">
              Confirm Payslip
            </Button>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Subheading>History</Subheading>
        <Table className="mt-4 [--gutter:--spacing(4)]">
          <TableHead>
            <TableRow>
              <TableHeader>Period</TableHeader>
              <TableHeader>Schema</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Gross</TableHeader>
              <TableHeader>Net</TableHeader>
              <TableHeader>Tax</TableHeader>
              <TableHeader>Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No payslips uploaded yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.periodMonth}/{row.periodYear}
                  </TableCell>
                  <TableCell>{row.schemaVersion}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.breakdown?.gross ?? "-"}</TableCell>
                  <TableCell>{row.breakdown?.net ?? "-"}</TableCell>
                  <TableCell>{row.breakdown?.tax ?? "-"}</TableCell>
                  <TableCell>
                    {row.status === "EXTRACTED" ? (
                      <Button plain onClick={() => loadExtractedDraft(row.id)} type="button">
                        {loadingDraftId === row.id ? "Loading..." : "Resume Review"}
                      </Button>
                    ) : (
                      <span className="text-sm/6 text-zinc-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </PageShell>
  );
}
