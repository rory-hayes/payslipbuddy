export type JobType = "extraction" | "annual_report_export" | "monthly_reminder";
export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __PAYSLIP_BUDDY_JOBS__: JobRecord[] | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `job_${crypto.randomUUID()}`;
}

function state(): JobRecord[] {
  if (!globalThis.__PAYSLIP_BUDDY_JOBS__) {
    globalThis.__PAYSLIP_BUDDY_JOBS__ = [];
  }

  return globalThis.__PAYSLIP_BUDDY_JOBS__;
}

export function enqueueJob(type: JobType, payload: Record<string, unknown>, maxAttempts = 3): JobRecord {
  const job: JobRecord = {
    id: newId(),
    type,
    status: "QUEUED",
    payload,
    attempts: 0,
    maxAttempts,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  state().push(job);
  return job;
}

export async function processJob<T>(job: JobRecord, handler: () => Promise<T>): Promise<T> {
  job.status = "PROCESSING";
  job.attempts += 1;
  job.updatedAt = nowIso();

  try {
    const result = await handler();
    job.status = "COMPLETED";
    job.error = null;
    job.updatedAt = nowIso();
    return result;
  } catch (error) {
    job.status = job.attempts >= job.maxAttempts ? "FAILED" : "QUEUED";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.updatedAt = nowIso();
    throw error;
  }
}

export function listJobs(type?: JobType): JobRecord[] {
  const rows = state();
  return type ? rows.filter((job) => job.type === type) : rows;
}
