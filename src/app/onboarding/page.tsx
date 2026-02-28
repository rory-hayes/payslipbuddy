"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/catalyst/button";
import { Field, FieldGroup, Fieldset, Label, Legend } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";
import { DEMO_USER_ID } from "@/lib/constants";

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

export default function OnboardingPage() {
  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [householdName, setHouseholdName] = useState("My Household");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    const result = await apiFetch<OnboardingResult>("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: DEMO_USER_ID,
        region,
        householdName
      })
    });

    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not save onboarding settings.");
      setBusy(false);
      return;
    }

    setStatus(`Saved. Region ${result.data.user.region} with currency ${result.data.user.currency}.`);
    setBusy(false);
  }

  return (
    <PageShell
      title="Onboarding"
      subtitle="Set your region and household defaults. Region controls schema validation, currency formatting, and report labels."
      actions={
        <Button href="/dashboard" outline>
          Go to Dashboard
        </Button>
      }
    >
      <section className="max-w-2xl rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <form onSubmit={submit}>
          <Fieldset>
            <Legend>Profile Setup</Legend>
            <Text>You can update these values later from workspace settings.</Text>
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
            </FieldGroup>
          </Fieldset>

          <div className="mt-6">
            <Button disabled={busy} type="submit">
              {busy ? "Saving..." : "Save Onboarding"}
            </Button>
          </div>
        </form>

        {status ? <Text className="mt-4">{status}</Text> : null}
      </section>
    </PageShell>
  );
}
