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

function toFriendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("rate limit")) {
    return "Too many authentication emails were requested recently. Please wait a few minutes and try again.";
  }
  if (value.includes("invalid login credentials")) {
    return "Email or password is incorrect. Please try again.";
  }
  if (value.includes("email address") && value.includes("invalid")) {
    return "Please enter a valid email address.";
  }
  return message;
}

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
      return "/dashboard";
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
        setStatus(toFriendlyAuthError(result.error));
        return;
      }
      router.replace(nextPath);
      return;
    }

    const signup = await signUpWithPassword(email, password);
    if (signup.error) {
      setBusy(false);
      setStatus(toFriendlyAuthError(signup.error));
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
      setStatus(toFriendlyAuthError("Account created. Please sign in."));
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
      setStatus(toFriendlyAuthError(result.error));
      return;
    }

    setStatus("Magic link sent. Check your inbox and follow the secure sign-in link.");
  }

  return (
    <div className="mx-auto grid min-h-[85svh] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="hidden rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm lg:block">
        <Badge color="blue">PaySlip Buddy Account</Badge>
        <Heading className="mt-6 max-w-xl">Create your secure payslip workspace and start your onboarding journey.</Heading>
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <Image
            src="/branding/onboarding-journey-theme.webp"
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

        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block space-y-2">
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
          <label className="block space-y-2">
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
          <div className="pt-1">
            <Button type="submit" disabled={busy} className="w-full justify-center sm:w-auto">
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </div>
        </form>

        {mode === "signin" ? (
          <div className="mt-6 space-y-2">
            <Text>Passwordless option</Text>
            <Button plain disabled={busy} onClick={() => void sendLink()} type="button">
              Send magic link
            </Button>
          </div>
        ) : null}

        {!hasSupabase ? (
          <Text className="mt-5 text-amber-700">Supabase env vars are missing. Configure auth keys to enable signup/login.</Text>
        ) : null}

        {status ? (
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <Text>{status}</Text>
          </div>
        ) : null}

        <Divider className="my-7" />

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
