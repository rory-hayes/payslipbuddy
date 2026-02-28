import { Badge } from "@/components/catalyst/badge";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <div className="flex items-center gap-2">
        <Badge color="blue">Privacy</Badge>
        <Badge color="zinc">Summary</Badge>
      </div>
      <Heading>Privacy Summary</Heading>
      <Text className="max-w-3xl text-zinc-600">
        This page provides a plain-language summary of how PaySlip Buddy handles account, payroll, and household data.
        It is designed for quick understanding before full policy review.
      </Text>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>What We Collect</Subheading>
        <ul className="mt-4 space-y-2 text-sm/6 text-zinc-700">
          <li>Account identity information (email and authentication metadata).</li>
          <li>Payslip files you upload and extracted payroll fields.</li>
          <li>Budget inputs, goals, and household workspace settings.</li>
          <li>Operational logs required for reliability, billing, and security.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>How Data Is Used</Subheading>
        <ul className="mt-4 space-y-2 text-sm/6 text-zinc-700">
          <li>To provide payslip extraction, review, monthly analytics, and annual reporting features.</li>
          <li>To enforce plan limits and subscription entitlements.</li>
          <li>To support household collaboration in shared workspaces.</li>
          <li>To improve reliability and prevent abuse.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>Your Controls</Subheading>
        <ul className="mt-4 space-y-2 text-sm/6 text-zinc-700">
          <li>You can request deletion of uploaded records and remove data from your workspace.</li>
          <li>You can export annual report artifacts (PDF/XLSX) for portability.</li>
          <li>You can update reminders, profile defaults, and household settings at any time.</li>
          <li>PaySlip Buddy does not sell your personal payroll data.</li>
        </ul>
      </section>
    </div>
  );
}
