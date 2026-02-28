"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/catalyst/button";
import { Input } from "@/components/catalyst/input";
import { apiFetch } from "@/lib/client-api";
import { DEMO_HOUSEHOLD_ID, DEMO_USER_ID } from "@/lib/constants";

interface HouseholdSummary {
  usage: {
    plan: string;
  } | null;
  sharing: {
    allowed: boolean;
    reason?: string;
  };
  household: {
    id: string;
    name: string;
  } | null;
  members: Array<{
    userId: string;
    role: "OWNER" | "MEMBER";
    status: string;
    createdAt: string;
  }>;
}

export default function HouseholdPage() {
  const [data, setData] = useState<HouseholdSummary | null>(null);
  const [email, setEmail] = useState("partner@example.com");
  const [status, setStatus] = useState("");

  async function refresh() {
    const result = await apiFetch<HouseholdSummary>(`/api/household/summary?userId=${DEMO_USER_ID}`);
    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setStatus(result.error?.message ?? "Failed to load household summary.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const result = await apiFetch<{ message: string }>("/api/household/invite", {
      method: "POST",
      body: JSON.stringify({
        householdId: DEMO_HOUSEHOLD_ID,
        invitedBy: DEMO_USER_ID,
        email,
        role: "MEMBER"
      })
    });

    if (!result.ok || !result.data) {
      setStatus(result.error?.message ?? "Invite failed.");
      return;
    }

    setStatus(result.data.message);
    await refresh();
  }

  return (
    <PageShell
      title="Household Sharing"
      subtitle="Owner + Member model. Members can view shared summaries and export annual reports; owner manages billing and invites."
      actions={
        <Link href="/billing" className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
          Manage Billing
        </Link>
      }
    >
      {status ? <p className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{status}</p> : null}

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Workspace</h2>
        <p className="mt-2 text-sm text-slate-700">
          Plan: {data?.usage?.plan ?? "FREE"}. Sharing status: {data?.sharing.allowed ? "enabled" : "locked"}.
        </p>
        {!data?.sharing.allowed ? (
          <p className="mt-2 text-sm text-amber-700">
            {data?.sharing.reason ?? "Upgrade to Pro to invite members and share annual reports."}
          </p>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Members</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {(data?.members ?? []).map((member) => (
              <li key={`${member.userId}:${member.createdAt}`} className="rounded-xl border border-slate-200 px-3 py-2">
                {member.userId} · {member.role} · {member.status}
              </li>
            ))}
          </ul>
        </article>

        <article className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Invite Member</h2>
          <form onSubmit={invite} className="mt-4 space-y-3">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@email.com"
              type="email"
            />
            <Button
              disabled={!data?.sharing.allowed}
              className="disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              Send Invite
            </Button>
            {!data?.sharing.allowed ? (
              <p className="text-xs text-amber-700">Upgrade to Pro to invite household members.</p>
            ) : null}
          </form>
        </article>
      </section>
    </PageShell>
  );
}
