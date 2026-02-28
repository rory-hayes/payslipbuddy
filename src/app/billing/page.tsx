"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/catalyst/button";
import { Text } from "@/components/catalyst/text";
import { apiFetch } from "@/lib/client-api";
import { DEMO_USER_ID } from "@/lib/constants";

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
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const result = await apiFetch<BillingSummary>(`/api/billing/summary?userId=${DEMO_USER_ID}`);
    if (result.ok && result.data) {
      setSummary(result.data);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startCheckout(planTier: "PLUS" | "PRO", billingCycle: "monthly" | "annual") {
    setLoading(true);
    setStatus("");

    const response = await apiFetch<{ checkoutUrl: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        userId: DEMO_USER_ID,
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
    const response = await apiFetch<{ enabled: boolean }>("/api/reminders/preference", {
      method: "POST",
      body: JSON.stringify({ userId: DEMO_USER_ID, enabled })
    });

    if (!response.ok) {
      setStatus(response.error?.message ?? "Failed to update reminders.");
      return;
    }

    setStatus(`Monthly reminder ${enabled ? "enabled" : "disabled"}.`);
    await refresh();
  }

  async function simulateActivation(planTier: "PLUS" | "PRO", billingCycle: "monthly" | "annual") {
    const response = await apiFetch<{ mappedStatus: string }>("/api/billing/webhook", {
      method: "POST",
      body: JSON.stringify({
        userId: DEMO_USER_ID,
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

  return (
    <PageShell
      title="Billing & Entitlements"
      subtitle="Free plan allows one payslip total. Plus unlocks annual dashboard/PDF; Pro adds XLSX export and household sharing."
    >
      {status ? <p className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{status}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Plan</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{summary?.user.plan ?? "FREE"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Subscription</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{summary?.usage?.subscriptionStatus ?? "TRIAL"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Usage</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {summary?.usage
              ? summary.usage.unlimitedPayslips
                ? "Unlimited"
                : `${summary.usage.freePayslipsUsed}/${summary.usage.freePayslipsLimit}`
              : "0/1"}
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Plus</h2>
          <p className="mt-2 text-sm text-slate-700">Unlimited payslips, MoM insights, annual dashboard, PDF export.</p>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PLUS", "monthly")}
              className="disabled:opacity-50"
              type="button"
            >
              Plus Monthly
            </Button>
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PLUS", "annual")}
              className="disabled:opacity-50"
              tone="secondary"
              type="button"
            >
              Plus Annual
            </Button>
            <Button
              disabled={!summary?.user.canManageBilling}
              onClick={() => simulateActivation("PLUS", "monthly")}
              className="disabled:opacity-50"
              tone="quiet"
              type="button"
            >
              Simulate Plus
            </Button>
          </div>
        </article>

        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Pro</h2>
          <p className="mt-2 text-sm text-slate-700">Everything in Plus plus XLSX export, household sharing, and multi-employer support.</p>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PRO", "monthly")}
              className="disabled:opacity-50"
              type="button"
            >
              Pro Monthly
            </Button>
            <Button
              disabled={loading || !summary?.user.canManageBilling}
              onClick={() => startCheckout("PRO", "annual")}
              className="disabled:opacity-50"
              tone="secondary"
              type="button"
            >
              Pro Annual
            </Button>
            <Button
              disabled={!summary?.user.canManageBilling}
              onClick={() => simulateActivation("PRO", "monthly")}
              className="disabled:opacity-50"
              tone="quiet"
              type="button"
            >
              Simulate Pro
            </Button>
          </div>
        </article>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold text-ink">Monthly Upload Reminder</h2>
        <p className="mt-2 text-sm text-slate-700">
          Default is enabled. You can opt out and re-enable anytime.
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => toggleReminder(true)} type="button">
            Enable Reminder
          </Button>
          <Button onClick={() => toggleReminder(false)} tone="secondary" type="button">
            Disable Reminder
          </Button>
        </div>
      </section>

      {summary && !summary.user.canManageBilling ? (
        <Text className="mt-4 text-amber-700">Billing can only be managed by the household owner.</Text>
      ) : null}
    </PageShell>
  );
}
