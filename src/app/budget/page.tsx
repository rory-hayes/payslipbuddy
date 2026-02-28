import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function BudgetPage() {
  return (
    <PageShell
      title="Budget Board (V1.5)"
      subtitle="Budget board, recurring planning, and bank CSV mapping are deferred to V1.5 while V1 focuses on Payslip OS, reporting, and household sharing."
      actions={
        <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Back to Dashboard
        </Link>
      }
    >
      <section className="card max-w-2xl p-6">
        <h2 className="text-lg font-semibold text-ink">Deferred Features</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>- Goals and recurring expense board</li>
          <li>- Planned vs actual monthly budgeting</li>
          <li>- Bank CSV import and column mapping</li>
        </ul>
      </section>
    </PageShell>
  );
}
