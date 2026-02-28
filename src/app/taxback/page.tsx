import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function TaxBackPage() {
  return (
    <PageShell
      title="TaxBack Estimates (V1.5)"
      subtitle="Numeric tax-back estimation is explicitly deferred to V1.5. V1 keeps payroll reporting educational and document-focused."
      actions={
        <Link href="/reports" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Open Reports
        </Link>
      }
    >
      <section className="card max-w-2xl p-6">
        <h2 className="text-lg font-semibold text-ink">What stays in V1</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>- Payslip extraction and confirmation workflow</li>
          <li>- MoM change detection and annual totals</li>
          <li>- Exportable Annual Income & Deductions report</li>
        </ul>
      </section>
    </PageShell>
  );
}
