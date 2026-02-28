import Image from "next/image";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";

const trustStrip = ["Encrypted storage", "GDPR-ready controls", "Delete data anytime", "No resale of payroll data"];

const steps = [
  {
    title: "Upload",
    description: "Drop a PDF or image payslip. Single-file flow keeps review simple and fast."
  },
  {
    title: "Review + Confirm",
    description: "AI extracts values, confidence is shown per field, and you can manually correct anything before save."
  },
  {
    title: "Track + Export",
    description: "See month-over-month changes and export a broker-ready annual PDF/XLSX pack in one click."
  }
];

const payrollIssues = [
  "Unexpected tax spikes",
  "New deductions that were not present last month",
  "Pension contribution variance",
  "Net pay drops despite similar gross pay",
  "Employer switching patterns over the year",
  "Missing months before annual reporting"
];

const useCases = [
  "Mortgage application income proof",
  "Annual tax preparation",
  "Job change compensation tracking",
  "Household planning with shared visibility"
];

const faq = [
  {
    q: "What file formats are supported?",
    a: "PDF, PNG, JPG, and WEBP payslips are supported in V1."
  },
  {
    q: "Do you auto-confirm extracted values?",
    a: "No. Users review extraction with confidence indicators and confirm manually."
  },
  {
    q: "Is this available for UK and Ireland only?",
    a: "Yes. V1 supports UK and IE with region-specific schema and currency."
  },
  {
    q: "Can I delete my payroll files?",
    a: "Yes. You can remove uploaded files, and retention controls are available in workspace settings."
  }
];

export default function HomePage() {
  return (
    <div className="space-y-10 py-4 sm:py-8">
      <section className="grid gap-6 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="blue">UK + IE Payslip Intelligence</Badge>
            <Badge color="emerald">Annual Broker Pack Ready</Badge>
          </div>

          <Heading className="max-w-xl">Spot payroll errors and explain every deduction in minutes.</Heading>
          <Text className="max-w-xl text-zinc-600">
            Upload monthly payslips, review AI extraction before save, track month-over-month deduction changes, and
            generate a broker-ready annual income pack in one click.
          </Text>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <Text className="font-medium text-blue-900">Mortgage pack includes</Text>
            <Text className="mt-1 text-blue-800">Last 3-6 months payslips, YTD totals, deductions summary, and employer timeline.</Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button href="/auth?mode=signup">Create free account</Button>
            <Button href="#sample-output" outline>
              View sample report
            </Button>
            <Button href="#how-it-works" plain>
              See how it works
            </Button>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          <div className="relative min-h-80">
            <Image
              src="/branding/landing-hero-product.png"
              alt="PaySlip Buddy product interface showing payslip upload, extraction review, and monthly trend chart"
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="object-cover"
            />
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {trustStrip.map((item) => (
            <Badge key={item} color="emerald">
              {item}
            </Badge>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <Button href="/security" outline>
              Security
            </Button>
            <Button href="/privacy" plain>
              Privacy
            </Button>
          </span>
        </div>
      </section>

      <section id="how-it-works" className="space-y-4">
        <div>
          <Subheading>How It Works</Subheading>
          <Text className="mt-1 text-zinc-600">Three steps from upload to defensible annual reporting.</Text>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <Badge color="blue">Step {index + 1}</Badge>
              <p className="mt-3 text-lg/7 font-semibold text-zinc-950">{step.title}</p>
              <Text className="mt-2 text-zinc-600">{step.description}</Text>
            </article>
          ))}
        </div>
      </section>

      <section id="sample-output" className="space-y-4">
        <div>
          <Subheading>Output Examples</Subheading>
          <Text className="mt-1 text-zinc-600">Concrete artifacts users pay for: annual report pack and monthly change intelligence.</Text>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="relative min-h-72">
              <Image
                src="/branding/landing-report-pack.png"
                alt="Annual Income and Deductions export pack preview in PDF and XLSX formats"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="border-t border-zinc-200 p-4">
              <p className="text-sm/6 font-semibold text-zinc-950">Annual Income & Deductions Pack</p>
              <Text className="text-zinc-600">2-4 page PDF plus structured XLSX tabs for accountant and broker workflows.</Text>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="relative min-h-72">
              <Image
                src="/branding/landing-mom-diff.png"
                alt="Month-over-month payroll deduction change analysis with tax and pension deltas"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="border-t border-zinc-200 p-4">
              <p className="text-sm/6 font-semibold text-zinc-950">Month-over-month deduction intelligence</p>
              <Text className="text-zinc-600">Highlights what changed, by how much, and where net pay was impacted.</Text>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>What You&apos;ll Catch</Subheading>
          <ul className="mt-4 space-y-2">
            {payrollIssues.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm/6 text-zinc-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Subheading>Common Use Cases</Subheading>
          <ul className="mt-4 space-y-2">
            {useCases.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm/6 text-zinc-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <Subheading>Pricing Preview</Subheading>
          <Text className="mt-1 text-zinc-600">Free to start. Upgrade when you need unlimited history, exports, and sharing.</Text>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <Badge color="zinc">Free</Badge>
            <p className="mt-3 text-2xl/8 font-semibold text-zinc-950">€0</p>
            <Text className="mt-2 text-zinc-600">1 payslip total, basic dashboard, no annual export.</Text>
          </article>
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <Badge color="blue">Plus</Badge>
            <p className="mt-3 text-2xl/8 font-semibold text-zinc-950">€7-€9 / month</p>
            <Text className="mt-2 text-zinc-700">Unlimited payslips, MoM insights, annual dashboard and PDF export.</Text>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <Badge color="emerald">Pro</Badge>
            <p className="mt-3 text-2xl/8 font-semibold text-zinc-950">€12-€15 / month</p>
            <Text className="mt-2 text-zinc-700">Plus features, XLSX export, household sharing, multi-employer support.</Text>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Subheading>FAQ</Subheading>
        <div className="mt-4 space-y-3">
          {faq.map((entry) => (
            <details key={entry.q} className="rounded-xl border border-zinc-200 p-4">
              <summary className="cursor-pointer text-sm/6 font-semibold text-zinc-950">{entry.q}</summary>
              <Text className="mt-2 text-zinc-600">{entry.a}</Text>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-900 bg-zinc-900 p-6 text-white shadow-sm sm:p-8">
        <Heading level={2}>Know your pay. Prove your income. Plan with confidence.</Heading>
        <Text className="mt-2 max-w-2xl text-zinc-300">
          Start with one payslip for free, validate every deduction, and export a professional annual artifact when it matters.
        </Text>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/auth?mode=signup" color="blue">
            Create free account
          </Button>
          <Button href="/auth?mode=signin" color="white">
            Sign in
          </Button>
        </div>
      </section>
    </div>
  );
}
