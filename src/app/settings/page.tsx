"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Checkbox, CheckboxField, CheckboxGroup } from "@/components/catalyst/checkbox";
import { Field, FieldGroup, Fieldset, Label, Legend } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";

interface ProfilePayload {
  user: {
    id: string;
    region: "UK" | "IE";
    currency: "GBP" | "EUR";
    reminderEnabled: boolean;
    onboardingCompleted: boolean;
    budgetSetupCompleted: boolean;
    monthlyIncomeTarget: number | null;
  };
  household: {
    id: string;
    name: string;
  } | null;
  employers: Array<{
    id: string;
    name: string;
  }>;
}

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [householdName, setHouseholdName] = useState("My Household");
  const [employerName, setEmployerName] = useState("Primary Employer");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState("");
  const [budgetSetupCompleted, setBudgetSetupCompleted] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user?.id) {
      setInitializing(false);
      return;
    }

    let alive = true;
    apiFetch<ProfilePayload>(`/api/onboarding/profile?userId=${user.id}`).then((result) => {
      if (!alive) {
        return;
      }

      if (!result.ok || !result.data) {
        setStatus(result.error?.message ?? "Could not load settings.");
        setInitializing(false);
        return;
      }

      setRegion(result.data.user.region);
      setReminderEnabled(result.data.user.reminderEnabled);
      setHouseholdName(result.data.household?.name ?? "My Household");
      setEmployerName(result.data.employers[0]?.name ?? "Primary Employer");
      setMonthlyIncomeTarget(
        result.data.user.monthlyIncomeTarget != null ? result.data.user.monthlyIncomeTarget.toString() : ""
      );
      setBudgetSetupCompleted(result.data.user.budgetSetupCompleted);
      setInitializing(false);
    });

    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    setBusy(true);
    setStatus("");

    const hasMonthlyTarget = monthlyIncomeTarget.trim().length > 0;
    const monthlyTarget = hasMonthlyTarget ? Number(monthlyIncomeTarget) : null;
    if (hasMonthlyTarget && (!Number.isFinite(monthlyTarget) || (monthlyTarget ?? 0) < 0)) {
      setBusy(false);
      setStatus("Monthly take-home baseline must be a non-negative number.");
      return;
    }

    const result = await apiFetch<ProfilePayload>("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        region,
        householdName,
        employerName,
        reminderEnabled,
        monthlyIncomeTarget: monthlyTarget,
        completeOnboarding: false
      })
    });

    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not update settings.");
      return;
    }

    setBudgetSetupCompleted(result.data.user.budgetSetupCompleted);
    setStatus(`Saved profile. Region ${result.data.user.region} with currency ${result.data.user.currency}.`);
  }

  if (loading || initializing) {
    return <Text>Loading settings...</Text>;
  }

  return (
    <PageShell
      title="Settings"
      subtitle="Update your profile defaults for payroll extraction and household setup."
      actions={
        <div className="flex items-center gap-2">
          <Badge color="blue">Profile</Badge>
          <Button href="/budget" outline>
            Open Budget Board
          </Button>
        </div>
      }
    >
      <section className="max-w-3xl rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <form onSubmit={submit}>
          <Fieldset>
            <Legend>Profile Defaults</Legend>
            <Text className="mt-1">These values are used in onboarding, payslip extraction defaults, and reminders.</Text>
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
                <Input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
              </Field>

              <Field>
                <Label>Primary Employer Name</Label>
                <Input value={employerName} onChange={(event) => setEmployerName(event.target.value)} />
              </Field>

              <Field>
                <Label>Expected Monthly Take-home Pay ({region === "UK" ? "GBP" : "EUR"})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyIncomeTarget}
                  onChange={(event) => setMonthlyIncomeTarget(event.target.value)}
                  placeholder="Optional"
                />
                <Text className="mt-1 text-xs text-zinc-500">
                  Used as your budget baseline. This is not a savings target.
                </Text>
              </Field>

              <Field>
                <Label>Notifications</Label>
                <CheckboxGroup>
                  <CheckboxField>
                    <Checkbox checked={reminderEnabled} onChange={setReminderEnabled} aria-label="Enable monthly upload reminders" />
                    <Label>Enable monthly payslip upload reminders</Label>
                  </CheckboxField>
                </CheckboxGroup>
              </Field>
            </FieldGroup>
          </Fieldset>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
            Budget setup status: {budgetSetupCompleted ? "Completed" : "Incomplete"}.
          </div>

          <div className="mt-6">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>

        {status ? (
          <div className="mt-4 rounded-xl border border-zinc-950/10 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
            {status}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
