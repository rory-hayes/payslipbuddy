"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/catalyst/button";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
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
  const [status, setStatus] = useState<string>("");
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
      subtitle="Choose your region and household workspace defaults. Region controls schemas, currency, and annual report labels."
      actions={
        <Link href="/dashboard" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm">
          Go to Dashboard
        </Link>
      }
    >
      <section className="card max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Region
            <Select
              value={region}
              onChange={(event) => setRegion(event.target.value as "UK" | "IE")}
              className="mt-2"
            >
              <option value="UK">United Kingdom (GBP)</option>
              <option value="IE">Ireland (EUR)</option>
            </Select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Household Name
            <Input
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              className="mt-2"
              placeholder="My Household"
            />
          </label>

          <Button disabled={busy} type="submit">
            {busy ? "Saving..." : "Save Onboarding"}
          </Button>
        </form>

        {status ? <Text className="mt-4">{status}</Text> : null}
      </section>
    </PageShell>
  );
}
