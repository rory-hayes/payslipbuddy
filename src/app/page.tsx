import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Heading, Subheading } from "@/components/catalyst/heading";
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
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-950/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="blue">Catalyst Build</Badge>
            <Badge color="emerald">Production-ready Direction</Badge>
          </div>

          <Heading className="max-w-4xl">
            Payslip OS for UK and Ireland users who need clean, explainable payroll records.
          </Heading>

          <Text className="max-w-3xl">
            Upload one payslip each month, validate extracted fields before save, track what changed, and export an
            annual document pack that is ready for accountants, brokers, and household planning.
          </Text>

          <div className="flex flex-wrap gap-3">
            <Button href="/onboarding">Start Onboarding</Button>
            <Button href="/dashboard" outline>
              Open Dashboard
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900"
          >
            <Text>{item.label}</Text>
            <p className="mt-2 text-2xl/8 font-semibold text-zinc-950 dark:text-white">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Trust Signals</Subheading>
          <ul className="mt-4 space-y-3">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm/6 text-zinc-700 dark:text-zinc-300">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>V1 Scope</Subheading>
          <ul className="mt-4 space-y-3 text-sm/6 text-zinc-700 dark:text-zinc-300">
            <li>Single payslip upload with UK/IE schema validation and editable review.</li>
            <li>MoM change detection for gross, net, tax, pension, and NI/PRSI/USC.</li>
            <li>Annual Income & Deductions report with downloadable PDF and XLSX exports.</li>
            <li>Household sharing with owner/member roles and server-side entitlement gates.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
