"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { apiFetch } from "@/lib/client-api";

interface BillingSummary {
  user: {
    plan: "FREE" | "PLUS" | "PRO";
    billingCycle: "MONTHLY" | "ANNUAL" | null;
    reminderEnabled: boolean;
    canManageBilling: boolean;
  };
  usage: {
    freePayslipsUsed: number;
    freePayslipsLimit: number;
    subscriptionStatus: string;
    unlimitedPayslips: boolean;
  } | null;
}

export default function BillingPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const result = await apiFetch<BillingSummary>(`/api/billing/summary?userId=${user.id}`);
    if (result.ok && result.data) {
      setSummary(result.data);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    void refresh();
  }, [refresh, user?.id]);

  async function startCheckout(planTier: "PLUS" | "PRO", billingCycle: "monthly" | "annual") {
    if (!user?.id) {
      setStatus("Sign in to manage billing.");
      return;
    }

    setLoading(true);
    setStatus("");

    const response = await apiFetch<{ checkoutUrl: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        planTier,
        billingCycle,
        successUrl: `${window.location.origin}/billing?success=1`,
        cancelUrl: `${window.location.origin}/billing?cancel=1`
      })
    });

    if (!response.ok || !response.data) {
      setStatus(response.error?.message ?? "Failed to start checkout.");
      setLoading(false);
      return;
    }

    setLoading(false);
    window.location.href = response.data.checkoutUrl;
  }

  async function toggleReminder(enabled: boolean) {
    if (!user?.id) {
      setStatus("Sign in to manage reminders.");
      return;
    }

    const response = await apiFetch<{ enabled: boolean }>("/api/reminders/preference", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, enabled })
    });

    if (!response.ok) {
      setStatus(response.error?.message ?? "Failed to update reminders.");
      return;
    }

    setStatus(`Monthly reminder ${enabled ? "enabled" : "disabled"}.`);
    await refresh();
  }

  async function simulateActivation(planTier: "PLUS" | "PRO", billingCycle: "monthly" | "annual") {
    if (!user?.id) {
      setStatus("Sign in to manage subscriptions.");
      return;
    }

    const response = await apiFetch<{ mappedStatus: string }>("/api/billing/webhook", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        status: "active",
        planTier,
        billingCycle
      })
    });

    if (!response.ok) {
      setStatus(response.error?.message ?? "Failed to simulate activation.");
      return;
    }

    setStatus(`Simulated subscription activation: ${planTier} ${billingCycle}.`);
    await refresh();
  }

  if (authLoading) {
    return <Text>Loading billing workspace...</Text>;
  }

  return (
    <PageShell
      title="Billing & Entitlements"
      subtitle="Free plan allows one payslip total. Plus unlocks annual dashboard/PDF. Pro adds XLSX export and household sharing."
    >
      {status ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          {status}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Current Plan</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">{summary?.user.plan ?? "FREE"}</p>
        </article>
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Subscription Status</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">
            {summary?.usage?.subscriptionStatus ?? "TRIAL"}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Text>Usage</Text>
          <p className="mt-2 text-3xl/9 font-semibold text-zinc-950 dark:text-white">
            {summary?.usage
              ? summary.usage.unlimitedPayslips
                ? "Unlimited"
                : `${summary.usage.freePayslipsUsed}/${summary.usage.freePayslipsLimit}`
              : "0/1"}
          </p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Subheading>Plus</Subheading>
            <Badge color="blue">Starter Paid</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
            <li>Unlimited payslips and MoM insights</li>
            <li>Annual dashboard and PDF export</li>
            <li>12-month history and reminders</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PLUS", "monthly")}
              type="button"
            >
              Plus Monthly
            </Button>
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PLUS", "annual")}
              outline
              type="button"
            >
              Plus Annual
            </Button>
            <Button
              disabled={!summary?.user.canManageBilling}
              onClick={() => simulateActivation("PLUS", "monthly")}
              plain
              type="button"
            >
              Simulate Plus
            </Button>
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Subheading>Pro</Subheading>
            <Badge color="emerald">Full Access</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
            <li>Everything in Plus</li>
            <li>XLSX exports and household sharing</li>
            <li>Extended retention options and multi-employer support</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PRO", "monthly")}
              type="button"
            >
              Pro Monthly
            </Button>
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PRO", "annual")}
              outline
              type="button"
            >
              Pro Annual
            </Button>
            <Button
              disabled={!summary?.user.canManageBilling}
              onClick={() => simulateActivation("PRO", "monthly")}
              plain
              type="button"
            >
              Simulate Pro
            </Button>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Subheading>Monthly Upload Reminder</Subheading>
        <Text className="mt-2">Default is enabled. You can opt out and re-enable anytime.</Text>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => toggleReminder(true)} type="button">
            Enable Reminder
          </Button>
          <Button onClick={() => toggleReminder(false)} outline type="button">
            Disable Reminder
          </Button>
        </div>
      </section>

      {summary && !summary.user.canManageBilling ? (
        <Text className="text-amber-700 dark:text-amber-300">Billing can only be managed by the household owner.</Text>
      ) : null}
    </PageShell>
  );
}
