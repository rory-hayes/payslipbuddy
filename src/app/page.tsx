import Image from "next/image";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";

const trustPoints = [
  "Review and correct extraction fields before any payslip is confirmed",
  "Track deduction changes month over month with clear context",
  "Generate annual PDF and XLSX artifacts suitable for brokers and accountants",
  "Collaborate in a shared household workspace with owner/member controls"
];

const highlights = [
  { label: "Regions", value: "UK + IE" },
  { label: "Plans", value: "Free, Plus, Pro" },
  { label: "Artifact quality", value: "Mortgage-ready" }
];

export default function HomePage() {
  return (
    <div className="space-y-10 py-4 sm:py-8">
      <section className="grid gap-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="blue">Payslip OS</Badge>
              <Badge color="emerald">Built for trust</Badge>
            </div>
            <Heading className="max-w-xl">Understand every payslip, every month, and prove your income with confidence.</Heading>
            <Text className="max-w-xl text-zinc-600">
              PaySlip Buddy helps users upload payslips, decode deductions, compare monthly changes, and export formal
              annual income reports.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button href="/auth?mode=signup">Create free account</Button>
            <Button href="/auth?mode=signin" outline>
              Sign in
            </Button>
          </div>
        </div>

        <div className="relative min-h-80 overflow-hidden rounded-2xl border border-zinc-200">
          <Image
            src="/branding/landing-hero.webp"
            alt="Professional reviewing payroll data on a laptop"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-transparent" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {highlights.map((item) => (
          <article key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <Text>{item.label}</Text>
            <p className="mt-2 text-2xl/8 font-semibold text-zinc-950">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>Why People Keep Using It</Subheading>
          <ul className="mt-4 space-y-3">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm/6 text-zinc-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="relative h-full min-h-80">
            <Image
              src="/branding/dashboard-analytics.webp"
              alt="Payroll analytics dashboard preview"
              fill
              className="object-cover"
            />
          </div>
        </article>
      </section>
    </div>
  );
}
