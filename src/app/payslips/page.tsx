"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

export default function PayslipsPage() {
  const { user, loading: authLoading } = useRequireAuth();
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

  async function uploadAndExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const selectedEmployerId = employerId || employers[0]?.id;
    if (!selectedEmployerId) {
      setMessage("Create an employer before uploading.");
      return;
    }

    if (!user?.id) {
      setMessage("Sign in to upload payslips.");
      return;
    }

    const upload = await apiFetch<UploadedPayload>("/api/payslips/upload", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
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

    const extract = await apiFetch<ExtractPayload>(`/api/payslips/${payslipId}/extract?userId=${user.id}`, {
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

      {message ? (
        <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Upload and Extract</Subheading>
          <Text className="mt-2">Supported files: PDF, PNG, JPG, WEBP.</Text>

          <form onSubmit={uploadAndExtract} className="mt-4 space-y-4">
            <label className="space-y-2">
              <Text>Storage Path</Text>
              <Input value={storagePath} onChange={(event) => setStoragePath(event.target.value)} />
            </label>

            <label className="space-y-2">
              <Text>Mime Type</Text>
              <Input value={mimeType} onChange={(event) => setMimeType(event.target.value)} />
            </label>

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

            <Button type="submit">Upload + Extract</Button>
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
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 space-y-2">
              <Text>Employer Name</Text>
              <Input value={draft.employerName} onChange={(event) => updateField("employerName", event.target.value)} />
            </label>
            <label className="space-y-2">
              <Text>Month</Text>
              <Input value={draft.periodMonth} onChange={(event) => updateField("periodMonth", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>Year</Text>
              <Input value={draft.periodYear} onChange={(event) => updateField("periodYear", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>Gross</Text>
              <Input value={draft.gross} onChange={(event) => updateField("gross", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>Net</Text>
              <Input value={draft.net} onChange={(event) => updateField("net", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>Tax</Text>
              <Input value={draft.tax} onChange={(event) => updateField("tax", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>Pension</Text>
              <Input value={draft.pension} onChange={(event) => updateField("pension", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>NI / PRSI</Text>
              <Input value={draft.niOrPrsi} onChange={(event) => updateField("niOrPrsi", Number(event.target.value))} type="number" />
            </label>
            <label className="space-y-2">
              <Text>USC</Text>
              <Input value={draft.usc ?? 0} onChange={(event) => updateField("usc", Number(event.target.value))} type="number" />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <Text>Confidence (0-1)</Text>
            <Input value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} type="number" step="0.01" min={0} max={1} />
          </label>

          <label className="mt-4 block space-y-2">
            <Text>Notes</Text>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="h-24" />
          </label>

          {Object.keys(draft.fieldConfidence).length > 0 ? (
            <div className="mt-4 rounded-xl border border-zinc-950/10 p-3 dark:border-white/10">
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
            <Button onClick={confirmDraft} disabled={!activePayslipId || requiredErrors.length > 0} type="button">
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
