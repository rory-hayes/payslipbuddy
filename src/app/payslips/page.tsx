"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/catalyst/button";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
import { Textarea } from "@/components/catalyst/textarea";
import { apiFetch } from "@/lib/client-api";
import { DEMO_USER_ID } from "@/lib/constants";
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

export default function PayslipsPage() {
  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [storagePath, setStoragePath] = useState("uploads/demo-payslip.pdf");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [activePayslipId, setActivePayslipId] = useState("");
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [employerId, setEmployerId] = useState("");
  const [newEmployerName, setNewEmployerName] = useState("Side Gig Ltd");
  const [draft, setDraft] = useState<ParsedPayslip>(createEmptyParsed("UK"));
  const [confidence, setConfidence] = useState(0.8);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<PayslipListRow[]>([]);
  const [loadingDraftId, setLoadingDraftId] = useState("");

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

  const refreshList = useCallback(async () => {
    const result = await apiFetch<PayslipListResponse>(`/api/payslips?userId=${DEMO_USER_ID}`);
    if (result.ok && result.data) {
      setRows(result.data.rows);
    }
  }, []);

  const refreshEmployers = useCallback(async () => {
    const result = await apiFetch<{ employers: EmployerRow[] }>(`/api/employers?userId=${DEMO_USER_ID}`);
    if (result.ok && result.data) {
      setEmployers(result.data.employers);
      if (!employerId && result.data.employers[0]) {
        setEmployerId(result.data.employers[0].id);
      }
    }
  }, [employerId]);

  useEffect(() => {
    void refreshList();
    void refreshEmployers();
    apiFetch<{ user: { region: "UK" | "IE" } }>(`/api/billing/summary?userId=${DEMO_USER_ID}`).then((result) => {
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
  }, [refreshList, refreshEmployers]);

  useEffect(() => {
    if (activePayslipId || rows.length === 0) {
      return;
    }

    const latestExtracted = rows.find((row) => row.status === "EXTRACTED");
    if (latestExtracted) {
      void loadExtractedDraft(latestExtracted.id, true);
    }
  }, [rows, activePayslipId]);

  async function loadExtractedDraft(payslipId: string, silent = false) {
    setLoadingDraftId(payslipId);

    const result = await apiFetch<ExtractDraftPayload>(`/api/payslips/${payslipId}/extract?userId=${DEMO_USER_ID}`);
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
    if (!silent) {
      setMessage(`Loaded review draft for payslip ${payslipId}.`);
    }
  }

  async function uploadAndExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const selectedEmployerId = employerId || employers[0]?.id;
    if (!selectedEmployerId) {
      setMessage("Create an employer before uploading.");
      return;
    }

    const upload = await apiFetch<UploadedPayload>("/api/payslips/upload", {
      method: "POST",
      body: JSON.stringify({
        userId: DEMO_USER_ID,
        employerId: selectedEmployerId,
        fileName: storagePath.split("/").pop() ?? "payslip.pdf",
        mimeType,
        storagePath
      })
    });

    if (!upload.ok || !upload.data) {
      setMessage(upload.error?.message ?? "Upload failed.");
      return;
    }

    const payslipId = upload.data.payslip.id;
    setActivePayslipId(payslipId);

    const extract = await apiFetch<ExtractPayload>(`/api/payslips/${payslipId}/extract`, {
      method: "POST",
      body: JSON.stringify({})
    });

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
    setMessage(`Extracted with confidence ${(extract.data.confidence * 100).toFixed(0)}%. Usage: ${usageLine}`);
    await refreshList();
  }

  async function createEmployer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await apiFetch<{ employer: EmployerRow }>("/api/employers", {
      method: "POST",
      body: JSON.stringify({
        userId: DEMO_USER_ID,
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
    if (!activePayslipId) {
      setMessage("Upload and extract a payslip first.");
      return;
    }

    const confirm = await apiFetch<{ payslip: { id: string; status: string } }>(
      `/api/payslips/${activePayslipId}/confirm`,
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

    setMessage(`Payslip ${confirm.data.payslip.id} confirmed.`);
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

  return (
    <PageShell
      title="Payslips"
      subtitle="Upload a payslip, review AI extraction with field confidence, and confirm only when required fields are valid."
    >
      <p className="mb-4 text-xs text-slate-500">Region profile: {region}. Schema defaults align after onboarding save.</p>
      <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Upload and Extract</h2>
          <p className="mt-1 text-xs text-slate-500">Supported files: PDF, PNG, JPG, WEBP.</p>
          <form onSubmit={uploadAndExtract} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Storage Path
              <Input
                value={storagePath}
                onChange={(event) => setStoragePath(event.target.value)}
                className="mt-1"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Mime Type
              <Input
                value={mimeType}
                onChange={(event) => setMimeType(event.target.value)}
                className="mt-1"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Employer
              <Select
                value={employerId}
                onChange={(event) => setEmployerId(event.target.value)}
                className="mt-1"
              >
                {employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>
                    {employer.name}
                  </option>
                ))}
              </Select>
            </label>

            <Button type="submit">
              Upload + Extract
            </Button>
          </form>

          <form onSubmit={createEmployer} className="mt-4 flex gap-2">
            <Input
              value={newEmployerName}
              onChange={(event) => setNewEmployerName(event.target.value)}
              className="w-full"
              placeholder="Create another employer"
            />
            <Button type="submit" tone="secondary">
              Add
            </Button>
          </form>

          {message ? <Text className="mt-3">{message}</Text> : null}
        </article>

        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Review Before Save</h2>
          <p className="mt-1 text-xs text-slate-500">Schema: {draft.schemaVersion}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <label className="col-span-2">
              Employer Name
              <Input
                value={draft.employerName}
                onChange={(event) => updateField("employerName", event.target.value)}
                className="mt-1"
              />
            </label>
            <label>
              Month
              <Input
                value={draft.periodMonth}
                onChange={(event) => updateField("periodMonth", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              Year
              <Input
                value={draft.periodYear}
                onChange={(event) => updateField("periodYear", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              Gross
              <Input
                value={draft.gross}
                onChange={(event) => updateField("gross", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              Net
              <Input
                value={draft.net}
                onChange={(event) => updateField("net", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              Tax
              <Input
                value={draft.tax}
                onChange={(event) => updateField("tax", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              Pension
              <Input
                value={draft.pension}
                onChange={(event) => updateField("pension", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              NI / PRSI
              <Input
                value={draft.niOrPrsi}
                onChange={(event) => updateField("niOrPrsi", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
            <label>
              USC
              <Input
                value={draft.usc ?? 0}
                onChange={(event) => updateField("usc", Number(event.target.value))}
                type="number"
                className="mt-1"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm">
            Confidence (0-1)
            <Input
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              type="number"
              step="0.01"
              min={0}
              max={1}
              className="mt-1"
            />
          </label>

          <label className="mt-3 block text-sm">
            Notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 h-20"
            />
          </label>

          {Object.keys(draft.fieldConfidence).length > 0 ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">Field Confidence</p>
              <ul className="mt-1 space-y-1">
                {Object.entries(draft.fieldConfidence).map(([field, value]) => (
                  <li key={field}>
                    {field}: {(value * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {requiredErrors.length > 0 ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Resolve validation errors before confirm</p>
              <ul className="mt-1 space-y-1">
                {requiredErrors.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            onClick={confirmDraft}
            disabled={!activePayslipId || requiredErrors.length > 0}
            className="mt-4 disabled:opacity-50"
            type="button"
          >
            Confirm Payslip
          </Button>
        </article>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold text-ink">History</h2>
        <div className="table-shell mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Period</th>
                <th className="py-2">Schema</th>
                <th className="py-2">Status</th>
                <th className="py-2">Gross</th>
                <th className="py-2">Net</th>
                <th className="py-2">Tax</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2">
                    {row.periodMonth}/{row.periodYear}
                  </td>
                  <td className="py-2">{row.schemaVersion}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">{row.breakdown?.gross ?? "-"}</td>
                  <td className="py-2">{row.breakdown?.net ?? "-"}</td>
                  <td className="py-2">{row.breakdown?.tax ?? "-"}</td>
                  <td className="py-2">
                    {row.status === "EXTRACTED" ? (
                      <button
                        onClick={() => loadExtractedDraft(row.id)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        {loadingDraftId === row.id ? "Loading..." : "Resume Review"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
