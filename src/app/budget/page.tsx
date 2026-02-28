import { Button } from "@/components/catalyst/button";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";

export default function BudgetPage() {
  return (
    <PageShell
      title="Budget Board (V1.5)"
      subtitle="Budget planning, recurring goals, and bank CSV mapping are intentionally deferred to V1.5 so V1 can focus on Payslip OS quality."
      actions={
        <Button href="/dashboard" outline>
          Back to Dashboard
        </Button>
      }
    >
      <section className="max-w-2xl rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Subheading>Deferred Features</Subheading>
        <ul className="mt-4 space-y-3">
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">Goals and recurring expense board</li>
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">Planned vs actual monthly budgeting</li>
          <li className="text-sm/6 text-zinc-700 dark:text-zinc-300">Bank CSV import and column mapping</li>
        </ul>
        <Text className="mt-4">This route remains visible to show roadmap clarity without diluting the V1 delivery focus.</Text>
      </section>
    </PageShell>
  );
}
