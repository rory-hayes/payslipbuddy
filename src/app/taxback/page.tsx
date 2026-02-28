import { Button } from "@/components/catalyst/button";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";

export default function TaxBackPage() {
  return (
    <PageShell
      title="TaxBack Estimates (V1.5)"
      subtitle="Numeric tax-back estimation is deferred to V1.5. V1 is focused on payroll extraction quality and formal annual reporting outputs."
      actions={
        <Button href="/reports" outline>
          Open Reports
        </Button>
      }
    >
      <section className="max-w-2xl rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Subheading>What Stays in V1</Subheading>
        <ul className="mt-4 space-y-3">
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">Payslip extraction and confirmation workflow</li>
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">MoM change detection and annual totals</li>
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">Exportable Annual Income & Deductions report</li>
        </ul>
        <Text className="mt-4">Tax guidance remains educational and link-based until numeric estimators are launched in V1.5.</Text>
      </section>
    </PageShell>
  );
}
