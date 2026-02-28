"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Divider } from "@/components/catalyst/divider";
import { Heading } from "@/components/catalyst/heading";
import { Input } from "@/components/catalyst/input";
import { Text } from "@/components/catalyst/text";

type AuthMode = "signin" | "signup";

function AuthPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasSupabase, sendMagicLink, signInWithPassword, signUpWithPassword } = useAuth();

  const initialMode = (searchParams.get("mode") ?? "signin") as AuthMode;
  const [mode, setMode] = useState<AuthMode>(initialMode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) {
      return "/onboarding";
    }
    return next;
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setBusy(true);

    if (mode === "signin") {
      const result = await signInWithPassword(email, password);
      setBusy(false);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      router.replace(nextPath);
      return;
    }

    const signup = await signUpWithPassword(email, password);
    if (signup.error) {
      setBusy(false);
      setStatus(signup.error);
      return;
    }

    if (signup.emailConfirmationRequired) {
      setBusy(false);
      setStatus("Account created. Check your email to confirm your address, then sign in.");
      setMode("signin");
      return;
    }

    const signin = await signInWithPassword(email, password);
    setBusy(false);
    if (signin.error) {
      setStatus("Account created. Please sign in.");
      setMode("signin");
      return;
    }

    router.replace("/onboarding");
  }

  async function sendLink() {
    if (!email) {
      setStatus("Enter your email first, then request a magic link.");
      return;
    }

    setBusy(true);
    setStatus("");
    const result = await sendMagicLink(email, `${window.location.origin}/auth?mode=signin`);
    setBusy(false);

    if (result.error) {
      setStatus(result.error);
      return;
    }

    setStatus("Magic link sent. Check your inbox and follow the secure sign-in link.");
  }

  return (
    <div className="mx-auto grid min-h-[85svh] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="hidden rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm lg:block">
        <Badge color="blue">PaySlip Buddy Account</Badge>
        <Heading className="mt-6 max-w-xl">Create your secure payslip workspace and start your onboarding journey.</Heading>
        <Text className="mt-4 max-w-xl">
          Your account lets you store monthly uploads, track deduction changes, and generate professional annual reports.
        </Text>
        <ul className="mt-8 space-y-3">
          {[
            "Secure account login with Supabase authentication",
            "Guided onboarding for region, household, and first employer",
            "Personalized dashboard with budget and payroll trends"
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm/6 text-zinc-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <div className="relative mt-8 overflow-hidden rounded-2xl border border-zinc-200">
          <Image
            src="/branding/onboarding-journey-pro.webp"
            alt="Onboarding journey illustration"
            width={768}
            height={768}
            className="h-auto w-full"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between">
          <Heading level={2}>{mode === "signin" ? "Sign in" : "Create account"}</Heading>
          <Badge color="zinc">{mode === "signin" ? "Returning user" : "New user"}</Badge>
        </div>
        <Text className="mt-2">
          {mode === "signin"
            ? "Sign in to continue to your payroll workspace."
            : "Create your account to begin onboarding."}
        </Text>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="space-y-2">
            <Text>Email</Text>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="space-y-2">
            <Text>Password</Text>
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {mode === "signin" ? (
          <div className="mt-4 space-y-2">
            <Text>Passwordless option</Text>
            <Button plain disabled={busy} onClick={() => void sendLink()} type="button">
              Send magic link
            </Button>
          </div>
        ) : null}

        {!hasSupabase ? (
          <Text className="mt-4 text-amber-700">Supabase env vars are missing. Configure auth keys to enable signup/login.</Text>
        ) : null}

        {status ? <Text className="mt-4">{status}</Text> : null}

        <Divider className="my-6" />

        <div className="flex flex-wrap items-center gap-2">
          <Text>{mode === "signin" ? "No account yet?" : "Already have an account?"}</Text>
          <Button
            plain
            onClick={() => {
              setStatus("");
              setMode((current) => (current === "signin" ? "signup" : "signin"));
            }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-600">Loading authentication...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
