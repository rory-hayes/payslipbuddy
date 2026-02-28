"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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

type WizardStep = "region" | "household" | "employer" | "budget" | "goals" | "review";

const stepOrder: WizardStep[] = ["region", "household", "employer", "budget", "goals", "review"];

const stepLabels: Record<WizardStep, string> = {
  region: "Region",
  household: "Household",
  employer: "Payroll setup",
  budget: "Budget baseline",
  goals: "Goals + upcoming",
  review: "Review + finish"
};

interface BudgetSeed {
  recurringExpenses: Array<{ id?: string; category: string; amount: number }>;
  upcomingExpenses: Array<{ id?: string; category: string; amount: number; dueDate?: string | null }>;
  goals: Array<{ id?: string; name: string; targetAmount: number; targetDate?: string | null; progressAmount?: number }>;
}

interface OnboardingResult {
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
  budgetSeed: BudgetSeed;
}

interface BudgetRow {
  id: string;
  category: string;
  amount: string;
}

interface UpcomingRow extends BudgetRow {
  dueDate: string;
}

interface GoalRow {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseStep(value: string | null): WizardStep {
  if (!value) {
    return "region";
  }

  return stepOrder.includes(value as WizardStep) ? (value as WizardStep) : "region";
}

function parseOptionalAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function asAmount(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useRequireAuth();

  const currentStep = useMemo(() => parseStep(searchParams.get("step")), [searchParams]);
  const currentStepIndex = stepOrder.indexOf(currentStep);

  const [region, setRegion] = useState<"UK" | "IE">("UK");
  const [householdName, setHouseholdName] = useState("My Household");
  const [employerName, setEmployerName] = useState("Primary Employer");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState("");
  const [budgetSkipped, setBudgetSkipped] = useState(false);
  const [recurringRows, setRecurringRows] = useState<BudgetRow[]>([{ id: makeId("rec"), category: "", amount: "" }]);
  const [upcomingRows, setUpcomingRows] = useState<UpcomingRow[]>([{ id: makeId("up"), category: "", amount: "", dueDate: "" }]);
  const [goalRows, setGoalRows] = useState<GoalRow[]>([{ id: makeId("goal"), name: "", targetAmount: "", targetDate: "" }]);

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const requested = searchParams.get("step");
    if (!requested) {
      router.replace("/onboarding?step=region");
      return;
    }

    if (parseStep(requested) !== requested) {
      router.replace("/onboarding?step=region");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user?.id) {
      setInitializing(false);
      return;
    }

    let alive = true;
    apiFetch<OnboardingResult>(`/api/onboarding/profile?userId=${user.id}`).then((result) => {
      if (!alive) {
        return;
      }

      if (!result.ok || !result.data) {
        setStatus(result.error?.message ?? "Could not load onboarding defaults.");
        setInitializing(false);
        return;
      }

      if (result.data.user.onboardingCompleted) {
        router.replace("/dashboard");
        return;
      }

      setRegion(result.data.user.region);
      setReminderEnabled(result.data.user.reminderEnabled);
      setHouseholdName(result.data.household?.name ?? "My Household");
      setEmployerName(result.data.employers[0]?.name ?? "Primary Employer");
      setMonthlyIncomeTarget(result.data.user.monthlyIncomeTarget != null ? result.data.user.monthlyIncomeTarget.toString() : "");

      if (result.data.budgetSeed.recurringExpenses.length > 0) {
        setRecurringRows(
          result.data.budgetSeed.recurringExpenses.map((entry) => ({
            id: entry.id ?? makeId("rec"),
            category: entry.category,
            amount: entry.amount.toString()
          }))
        );
      }

      if (result.data.budgetSeed.upcomingExpenses.length > 0) {
        setUpcomingRows(
          result.data.budgetSeed.upcomingExpenses.map((entry) => ({
            id: entry.id ?? makeId("up"),
            category: entry.category,
            amount: entry.amount.toString(),
            dueDate: entry.dueDate ?? ""
          }))
        );
      }

      if (result.data.budgetSeed.goals.length > 0) {
        setGoalRows(
          result.data.budgetSeed.goals.map((entry) => ({
            id: entry.id ?? makeId("goal"),
            name: entry.name,
            targetAmount: entry.targetAmount.toString(),
            targetDate: entry.targetDate ?? ""
          }))
        );
      }

      setBudgetSkipped(false);
      setInitializing(false);
    });

    return () => {
      alive = false;
    };
  }, [loading, router, user?.id]);

  function goToStep(step: WizardStep) {
    router.replace(`/onboarding?step=${step}`);
  }

  function normalizedRecurring() {
    const rows = recurringRows.filter((row) => row.category.trim().length > 0 || row.amount.trim().length > 0);
    const errors: string[] = [];
    const cleaned = rows.map((row, index) => {
      const category = row.category.trim();
      const amount = asAmount(row.amount);
      if (!category) {
        errors.push(`Recurring expense row ${index + 1} needs a category.`);
      }
      if (amount == null) {
        errors.push(`Recurring expense row ${index + 1} needs a valid non-negative amount.`);
      }
      return {
        category,
        amount: amount ?? 0
      };
    });

    return { errors, cleaned };
  }

  function normalizedUpcoming() {
    const rows = upcomingRows.filter(
      (row) => row.category.trim().length > 0 || row.amount.trim().length > 0 || row.dueDate.trim().length > 0
    );
    const errors: string[] = [];
    const cleaned = rows.map((row, index) => {
      const category = row.category.trim();
      const amount = asAmount(row.amount);
      if (!category) {
        errors.push(`Upcoming expense row ${index + 1} needs a category.`);
      }
      if (amount == null) {
        errors.push(`Upcoming expense row ${index + 1} needs a valid non-negative amount.`);
      }
      return {
        category,
        amount: amount ?? 0,
        dueDate: row.dueDate.trim() ? row.dueDate : null
      };
    });

    return { errors, cleaned };
  }

  function normalizedGoals() {
    const rows = goalRows.filter((row) => row.name.trim().length > 0 || row.targetAmount.trim().length > 0 || row.targetDate.trim().length > 0);
    const errors: string[] = [];
    const cleaned = rows.map((row, index) => {
      const name = row.name.trim();
      const targetAmount = asAmount(row.targetAmount);
      if (!name) {
        errors.push(`Goal row ${index + 1} needs a name.`);
      }
      if (targetAmount == null) {
        errors.push(`Goal row ${index + 1} needs a valid non-negative target amount.`);
      }
      return {
        name,
        targetAmount: targetAmount ?? 0,
        targetDate: row.targetDate.trim() ? row.targetDate : null
      };
    });

    return { errors, cleaned };
  }

  function validateStep(step: WizardStep): string | null {
    if (step === "region") {
      return region === "UK" || region === "IE" ? null : "Select a valid region.";
    }

    if (step === "household") {
      const name = householdName.trim();
      if (name.length < 2 || name.length > 80) {
        return "Household name must be between 2 and 80 characters.";
      }
      return null;
    }

    if (step === "employer") {
      const name = employerName.trim();
      if (name.length < 2 || name.length > 100) {
        return "Primary employer name must be between 2 and 100 characters.";
      }
      return null;
    }

    if (step === "budget" || step === "goals" || step === "review") {
      if (monthlyIncomeTarget.trim().length > 0 && parseOptionalAmount(monthlyIncomeTarget) == null) {
        return "Monthly income target must be a non-negative number.";
      }

      if (budgetSkipped) {
        return null;
      }

      const recurring = normalizedRecurring();
      const upcoming = normalizedUpcoming();
      const goals = normalizedGoals();
      const errors = [...recurring.errors, ...upcoming.errors, ...goals.errors];
      if (errors.length > 0) {
        return errors[0] ?? "Fix budget fields to continue.";
      }

      if (recurring.cleaned.length === 0 && goals.cleaned.length === 0) {
        return "Add at least one recurring expense or one savings goal, or skip budget setup.";
      }
    }

    return null;
  }

  function nextStep() {
    const error = validateStep(currentStep);
    if (error) {
      setStatus(error);
      return;
    }

    setStatus("");
    const next = stepOrder[currentStepIndex + 1];
    if (next) {
      goToStep(next);
    }
  }

  function previousStep() {
    const previous = stepOrder[currentStepIndex - 1];
    if (previous) {
      setStatus("");
      goToStep(previous);
    }
  }

  function skipBudget() {
    setBudgetSkipped(true);
    setStatus("Budget setup skipped for now. You can complete it later from the Budget page.");
    goToStep("review");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep !== "review") {
      nextStep();
      return;
    }

    if (!user?.id) {
      return;
    }

    const error = validateStep("review");
    if (error) {
      setStatus(error);
      return;
    }

    const recurring = normalizedRecurring().cleaned;
    const upcoming = normalizedUpcoming().cleaned;
    const goals = normalizedGoals().cleaned;

    setBusy(true);
    setStatus("");

    const result = await apiFetch<OnboardingResult>("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        region,
        householdName: householdName.trim(),
        employerName: employerName.trim(),
        reminderEnabled,
        monthlyIncomeTarget: parseOptionalAmount(monthlyIncomeTarget),
        completeOnboarding: true,
        budget: {
          skipped: budgetSkipped,
          monthlyIncomeTarget: parseOptionalAmount(monthlyIncomeTarget),
          recurringExpenses: recurring,
          upcomingExpenses: upcoming,
          goals
        }
      })
    });

    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Could not complete onboarding.");
      return;
    }

    router.replace("/dashboard");
  }

  if (loading || initializing) {
    return <Text>Loading onboarding...</Text>;
  }

  const recurringPreview = normalizedRecurring().cleaned;
  const upcomingPreview = normalizedUpcoming().cleaned;
  const goalsPreview = normalizedGoals().cleaned;

  return (
    <PageShell
      title="Onboarding Journey"
      subtitle="Set up your workspace in guided steps so payroll extraction, reporting, and budgeting are configured correctly from day one."
      actions={
        <div className="flex items-center gap-2">
          <Badge color="blue">
            Step {currentStepIndex + 1} / {stepOrder.length}
          </Badge>
        </div>
      }
    >
      <section className="grid max-w-6xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-6 flex flex-wrap gap-2">
            {stepOrder.map((step, index) => (
              <Badge key={step} color={step === currentStep ? "blue" : "zinc"}>
                {index + 1}. {stepLabels[step]}
              </Badge>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-6">
            <Fieldset>
              <Legend>{stepLabels[currentStep]}</Legend>
              <Text className="mt-1">
                {currentStep === "region" && "Choose the tax region that controls currency and payroll schema defaults."}
                {currentStep === "household" && "Set the shared household workspace name for reports and collaboration."}
                {currentStep === "employer" && "Add your primary employer so your first payslip upload has correct defaults."}
                {currentStep === "budget" && "Add monthly budget baseline details. You can skip and complete this later."}
                {currentStep === "goals" && "Set savings goals and optional upcoming expenses for a complete monthly plan."}
                {currentStep === "review" && "Review your setup before saving. Use Edit actions to adjust any section."}
              </Text>

              <FieldGroup className="mt-6 space-y-4">
                {currentStep === "region" ? (
                  <>
                    <Field>
                      <Label>Region</Label>
                      <Select value={region} onChange={(event) => setRegion(event.target.value as "UK" | "IE")}>
                        <option value="UK">United Kingdom (GBP)</option>
                        <option value="IE">Ireland (EUR)</option>
                      </Select>
                    </Field>
                    <Field>
                      <Label>Monthly reminders</Label>
                      <CheckboxGroup>
                        <CheckboxField>
                          <Checkbox checked={reminderEnabled} onChange={setReminderEnabled} aria-label="Enable reminders" />
                          <Label>Enable monthly payslip upload reminders</Label>
                        </CheckboxField>
                      </CheckboxGroup>
                    </Field>
                  </>
                ) : null}

                {currentStep === "household" ? (
                  <Field>
                    <Label>Household Name</Label>
                    <Input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="My Household" />
                  </Field>
                ) : null}

                {currentStep === "employer" ? (
                  <Field>
                    <Label>Primary Employer Name</Label>
                    <Input value={employerName} onChange={(event) => setEmployerName(event.target.value)} placeholder="Example Ltd" />
                  </Field>
                ) : null}

                {currentStep === "budget" ? (
                  <>
                    {budgetSkipped ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Budget setup is currently skipped.
                        <div className="mt-2">
                          <Button type="button" plain onClick={() => setBudgetSkipped(false)}>
                            Use budget setup instead
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <Field>
                      <Label>Monthly Income Target ({region === "UK" ? "GBP" : "EUR"})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={monthlyIncomeTarget}
                        onChange={(event) => setMonthlyIncomeTarget(event.target.value)}
                        placeholder="Optional"
                      />
                    </Field>

                    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Recurring Expenses (monthly)</p>
                        <Button
                          type="button"
                          plain
                          onClick={() =>
                            setRecurringRows((rows) => [...rows, { id: makeId("rec"), category: "", amount: "" }])
                          }
                        >
                          Add row
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {recurringRows.map((row) => (
                          <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                            <Input
                              value={row.category}
                              onChange={(event) =>
                                setRecurringRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === row.id ? { ...candidate, category: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Category"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={(event) =>
                                setRecurringRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === row.id ? { ...candidate, amount: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Amount"
                            />
                            <Button
                              type="button"
                              plain
                              onClick={() =>
                                setRecurringRows((rows) => (rows.length === 1 ? rows : rows.filter((candidate) => candidate.id !== row.id)))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {currentStep === "goals" ? (
                  <>
                    {budgetSkipped ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Budget setup is currently skipped.
                        <div className="mt-2">
                          <Button type="button" plain onClick={() => setBudgetSkipped(false)}>
                            Use budget setup instead
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Savings Goals</p>
                        <Button
                          type="button"
                          plain
                          onClick={() =>
                            setGoalRows((rows) => [...rows, { id: makeId("goal"), name: "", targetAmount: "", targetDate: "" }])
                          }
                        >
                          Add goal
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {goalRows.map((goal) => (
                          <div key={goal.id} className="grid gap-2 md:grid-cols-[1fr_170px_170px_auto]">
                            <Input
                              value={goal.name}
                              onChange={(event) =>
                                setGoalRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === goal.id ? { ...candidate, name: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Goal name"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={goal.targetAmount}
                              onChange={(event) =>
                                setGoalRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === goal.id ? { ...candidate, targetAmount: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Target amount"
                            />
                            <Input
                              type="date"
                              value={goal.targetDate}
                              onChange={(event) =>
                                setGoalRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === goal.id ? { ...candidate, targetDate: event.target.value } : candidate
                                  )
                                )
                              }
                            />
                            <Button
                              type="button"
                              plain
                              onClick={() =>
                                setGoalRows((rows) => (rows.length === 1 ? rows : rows.filter((candidate) => candidate.id !== goal.id)))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Upcoming Expenses (optional)</p>
                        <Button
                          type="button"
                          plain
                          onClick={() =>
                            setUpcomingRows((rows) => [...rows, { id: makeId("up"), category: "", amount: "", dueDate: "" }])
                          }
                        >
                          Add row
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {upcomingRows.map((row) => (
                          <div key={row.id} className="grid gap-2 md:grid-cols-[1fr_160px_170px_auto]">
                            <Input
                              value={row.category}
                              onChange={(event) =>
                                setUpcomingRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === row.id ? { ...candidate, category: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Category"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={(event) =>
                                setUpcomingRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === row.id ? { ...candidate, amount: event.target.value } : candidate
                                  )
                                )
                              }
                              placeholder="Amount"
                            />
                            <Input
                              type="date"
                              value={row.dueDate}
                              onChange={(event) =>
                                setUpcomingRows((rows) =>
                                  rows.map((candidate) =>
                                    candidate.id === row.id ? { ...candidate, dueDate: event.target.value } : candidate
                                  )
                                )
                              }
                            />
                            <Button
                              type="button"
                              plain
                              onClick={() =>
                                setUpcomingRows((rows) => (rows.length === 1 ? rows : rows.filter((candidate) => candidate.id !== row.id)))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {currentStep === "review" ? (
                  <div className="space-y-4">
                    <article className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Region + reminders</p>
                        <Button type="button" plain onClick={() => goToStep("region")}>
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm/6 text-zinc-700">
                        {region} ({region === "UK" ? "GBP" : "EUR"}) · Reminders {reminderEnabled ? "enabled" : "disabled"}
                      </p>
                    </article>

                    <article className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Household + employer</p>
                        <Button type="button" plain onClick={() => goToStep("household")}>
                          Edit
                        </Button>
                      </div>
                      <p className="text-sm/6 text-zinc-700">Household: {householdName.trim() || "Not set"}</p>
                      <p className="text-sm/6 text-zinc-700">Primary employer: {employerName.trim() || "Not set"}</p>
                    </article>

                    <article className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm/6 font-semibold text-zinc-950">Budget baseline</p>
                        <Button type="button" plain onClick={() => goToStep("budget")}>
                          Edit
                        </Button>
                      </div>
                      {budgetSkipped ? (
                        <p className="text-sm/6 text-zinc-700">Budget setup skipped. Dashboard will keep a reminder until completed.</p>
                      ) : (
                        <>
                          <p className="text-sm/6 text-zinc-700">
                            Monthly income target: {monthlyIncomeTarget.trim() ? monthlyIncomeTarget : "Not set"}
                          </p>
                          <p className="text-sm/6 text-zinc-700">Recurring expenses: {recurringPreview.length}</p>
                          <p className="text-sm/6 text-zinc-700">Upcoming expenses: {upcomingPreview.length}</p>
                          <p className="text-sm/6 text-zinc-700">Goals: {goalsPreview.length}</p>
                        </>
                      )}
                    </article>
                  </div>
                ) : null}
              </FieldGroup>
            </Fieldset>

            <div className="flex flex-wrap items-center gap-2">
              {currentStepIndex > 0 ? (
                <Button type="button" outline onClick={previousStep}>
                  Back
                </Button>
              ) : null}

              {currentStep === "budget" || currentStep === "goals" ? (
                <Button type="button" plain onClick={skipBudget}>
                  Skip budget setup
                </Button>
              ) : null}

              {currentStep !== "review" ? (
                <Button type="button" onClick={nextStep}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={busy}>
                  {busy ? "Completing..." : "Complete onboarding"}
                </Button>
              )}
            </div>
          </form>

          {status ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
              {status}
            </div>
          ) : null}
        </article>

        <aside className="flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-950/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Image
            src="/branding/onboarding-journey-theme.webp"
            alt="Onboarding visual"
            width={960}
            height={960}
            className="h-auto w-full max-w-[520px] object-contain"
            priority
          />
        </aside>
      </section>
    </PageShell>
  );
}
