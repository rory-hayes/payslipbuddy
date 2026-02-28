import { Badge } from "@/components/catalyst/badge";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";

const controls = [
  "Encryption in transit and at rest for payroll files and extracted records",
  "Signed URL access patterns for stored document assets",
  "Region-aware schema validation with user review before confirmation",
  "Row-level access protections for user and household scoped data",
  "Server-side entitlement checks for upload and export actions",
  "Audit logging for core user and billing events"
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <div className="flex items-center gap-2">
        <Badge color="blue">Security</Badge>
        <Badge color="emerald">Trust by Design</Badge>
      </div>
      <Heading>Security at PaySlip Buddy</Heading>
      <Text className="max-w-3xl text-zinc-600">
        PaySlip Buddy is built for sensitive payroll data handling. We prioritize controlled access, encrypted storage,
        and explicit user confirmation before extracted payroll values are finalized.
      </Text>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>Core Controls</Subheading>
        <ul className="mt-4 space-y-2">
          {controls.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm/6 text-zinc-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>Data Handling Principles</Subheading>
        <ul className="mt-4 space-y-2">
          <li className="text-sm/6 text-zinc-700">No sale of personal payroll data.</li>
          <li className="text-sm/6 text-zinc-700">User controls for deletion and export are supported.</li>
          <li className="text-sm/6 text-zinc-700">Minimum-access design for household sharing and billing actions.</li>
        </ul>
      </section>
    </div>
  );
}
