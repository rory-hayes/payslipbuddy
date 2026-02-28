import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Surface } from "@/components/catalyst/surface";
import { Text } from "@/components/catalyst/text";

const trustPoints = [
  "Editable extraction review before data is confirmed",
  "Monthly change detection across tax, pension, NI/PRSI and USC",
  "Professional annual PDF + XLSX designed for accountants and brokers",
  "Encrypted payslip source-file storage and audit logging",
  "Owner/member household mode with server-side entitlement gating"
];

const highlights = [
  { label: "Regions", value: "UK + IE" },
  { label: "Upload flow", value: "Single, guided" },
  { label: "Export quality", value: "Broker-ready" }
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-12">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
        <Surface className="space-y-6 p-7 md:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">Catalyst UI Build</Badge>
            <Badge tone="emerald">Production-focused</Badge>
          </div>

          <Heading className="max-w-4xl">
            Payslip intelligence platform for UK and Ireland teams who need dependable income records.
          </Heading>

          <Text className="max-w-3xl text-base/7 text-zinc-700">
            PaySlip Buddy converts payroll documents into clear month-over-month insights, annual income statements, and
            collaboration-ready household reporting. Built to reduce payroll ambiguity, not add noise.
          </Text>

          <div className="flex flex-wrap gap-3">
            <Button href="/onboarding" tone="primary">
              Start Onboarding
            </Button>
            <Button href="/dashboard" tone="secondary">
              Open Dashboard
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="card-muted p-3">
                <p className="field-label">{item.label}</p>
                <p className="metric-value mt-1 text-lg text-zinc-900">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="space-y-5 p-7">
          <Subheading>Trust Signals</Subheading>
          <ul className="space-y-2.5 text-sm text-zinc-700">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-zinc-900/80" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Surface>
      </section>
    </main>
  );
}
