"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Subheading } from "@/components/catalyst/heading";
import { Input } from "@/components/catalyst/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { Text } from "@/components/catalyst/text";
import { PageShell } from "@/components/page-shell";
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
    void refresh();
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
      subtitle="Owner/member model with shared payslip summaries and annual reports. Billing remains owner-managed."
      actions={
        <Button href="/billing" outline>
          Manage Billing
        </Button>
      }
    >
      {status ? (
        <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
          {status}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3">
          <Subheading>Workspace</Subheading>
          <Badge color={data?.sharing.allowed ? "emerald" : "amber"}>{data?.sharing.allowed ? "Enabled" : "Locked"}</Badge>
        </div>
        <Text className="mt-2">Plan: {data?.usage?.plan ?? "FREE"}</Text>
        {!data?.sharing.allowed ? (
          <Text className="mt-2 text-amber-700 dark:text-amber-300">
            {data?.sharing.reason ?? "Upgrade to Pro to invite members and share annual reports."}
          </Text>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Members</Subheading>
          <Table className="mt-4 [--gutter:--spacing(4)]">
            <TableHead>
              <TableRow>
                <TableHeader>User</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.members ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>No members yet.</TableCell>
                </TableRow>
              ) : (
                (data?.members ?? []).map((member) => (
                  <TableRow key={`${member.userId}:${member.createdAt}`}>
                    <TableCell>{member.userId}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>{member.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </article>

        <article className="rounded-2xl border border-zinc-950/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Subheading>Invite Member</Subheading>
          <form onSubmit={invite} className="mt-4 space-y-4">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@email.com" type="email" />
            <Button disabled={!data?.sharing.allowed} type="submit">
              Send Invite
            </Button>
            {!data?.sharing.allowed ? (
              <Text className="text-amber-700 dark:text-amber-300">Upgrade to Pro to invite household members.</Text>
            ) : null}
          </form>
        </article>
      </section>
    </PageShell>
  );
}
