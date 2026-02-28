"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/catalyst/button";
import { Checkbox, CheckboxField, CheckboxGroup } from "@/components/catalyst/checkbox";
import { Field, FieldGroup, Fieldset, Label, Legend } from "@/components/catalyst/fieldset";
import { Badge } from "@/components/catalyst/badge";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";

interface OnboardingResult {
  user: {
    region: "UK" | "IE";
    currency: "GBP" | "EUR";
  };
  household: {
    id: string;
    name: string;
  } | null;
}

const steps = ["Region", "Household", "Payroll setup", "Finish"] as const;

export default function OnboardingPage() {
  const { user, loading } = useRequireAuth();

  const [step, setStep] = useState(0);
  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [householdName, setHouseholdName] = useState("My Household");
  const [employerName, setEmployerName] = useState("Primary Employer");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const completion = useMemo(() => `${step + 1} / ${steps.length}`, [step]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    setBusy(true);
    setStatus("");

    const result = await apiFetch<OnboardingResult>("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        region,
        householdName,
        employerName,
        reminderEnabled
      })
    });

    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not save onboarding settings.");
      setBusy(false);
      return;
    }

    setStatus(`Saved. Region ${result.data.user.region} with currency ${result.data.user.currency}.`);
    setBusy(false);
    setStep(steps.length - 1);
  }

  if (loading) {
    return <Text>Loading onboarding...</Text>;
  }

  return (
    <PageShell
      title="Onboarding Journey"
      subtitle="Set up your workspace in three quick steps so your dashboard, reports, and reminders match your payroll reality."
      actions={
        <div className="flex items-center gap-2">
          <Badge color="blue">Step {completion}</Badge>
          <Button href="/dashboard" outline>
            Skip to Dashboard
          </Button>
        </div>
      }
    >
      <section className="grid max-w-5xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-6 flex flex-wrap gap-2">
            {steps.map((label, index) => (
              <Badge key={label} color={index <= step ? "blue" : "zinc"}>
                {index + 1}. {label}
              </Badge>
            ))}
          </div>

          <form onSubmit={submit}>
            <Fieldset>
              <Legend>Workspace Setup</Legend>
              <Text className="mt-1">Complete this once. You can update values later from billing and household pages.</Text>
              <FieldGroup className="mt-6 space-y-5">
                <Field>
                  <Label>Region</Label>
                  <Select value={region} onChange={(event) => setRegion(event.target.value as "UK" | "IE")}>
                    <option value="UK">United Kingdom (GBP)</option>
                    <option value="IE">Ireland (EUR)</option>
                  </Select>
                </Field>

                <Field>
                  <Label>Household Name</Label>
                  <Input
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
                    placeholder="My Household"
                  />
                </Field>

                <Field>
                  <Label>Primary Employer Name</Label>
                  <Input
                    value={employerName}
                    onChange={(event) => setEmployerName(event.target.value)}
                    placeholder="Example Ltd"
                  />
                </Field>

                <Field>
                  <Label>Notifications</Label>
                  <CheckboxGroup>
                    <CheckboxField>
                      <Checkbox
                        checked={reminderEnabled}
                        onChange={setReminderEnabled}
                        aria-label="Enable monthly upload reminders"
                      />
                      <Label>Enable monthly payslip upload reminders (recommended)</Label>
                    </CheckboxField>
                  </CheckboxGroup>
                </Field>
              </FieldGroup>
            </Fieldset>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving setup..." : "Complete onboarding"}
              </Button>
              <Button
                plain
                type="button"
                onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}
              >
                Next step preview
              </Button>
              <Button
                plain
                type="button"
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                Back
              </Button>
            </div>
          </form>

          {status ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              {status}
              <div className="mt-2">
                <Button href="/dashboard" plain>
                  Open your dashboard
                </Button>
              </div>
            </div>
          ) : null}
        </article>

        <aside className="overflow-hidden rounded-2xl border border-zinc-950/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Image
            src="/branding/onboarding-journey-pro.webp"
            alt="Onboarding visual"
            width={768}
            height={768}
            className="h-full w-full object-cover"
          />
        </aside>
      </section>
    </PageShell>
  );
}
