"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasSupabase: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; emailConfirmationRequired: boolean }>;
  sendMagicLink: (email: string, redirectTo?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistAccessToken(session: Session | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (session?.access_token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.access_token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

async function bootstrapWorkspace(user: User, session: Session | null) {
  const headers: HeadersInit = {
    "content-type": "application/json"
  };

  if (session?.access_token) {
    headers.authorization = `Bearer ${session.access_token}`;
  }

  await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers,
    body: JSON.stringify({
      userId: user.id,
      email: user.email ?? undefined
    })
  }).catch(() => null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const hasSupabase = Boolean(supabase);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) {
        return;
      }

      const nextSession = data.session ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      persistAccessToken(nextSession);

      if (nextSession?.user) {
        await bootstrapWorkspace(nextSession.user, nextSession);
      }

      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      persistAccessToken(nextSession ?? null);

      if (nextSession?.user) {
        void bootstrapWorkspace(nextSession.user, nextSession).finally(() => setLoading(false));
        return;
      }

      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        return { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        return {
          error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          emailConfirmationRequired: false
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      return {
        error: error?.message ?? null,
        emailConfirmationRequired: !data.session
      };
    },
    [supabase]
  );

  const sendMagicLink = useCallback(
    async (email: string, redirectTo?: string) => {
      if (!supabase) {
        return { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." };
      }

      const finalRedirect =
        redirectTo ?? (typeof window !== "undefined" ? `${window.location.origin}/auth?mode=signin` : undefined);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: finalRedirect ? { emailRedirectTo: finalRedirect } : undefined
      });

      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    persistAccessToken(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      hasSupabase,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      signOut
    }),
    [hasSupabase, loading, sendMagicLink, session, signInWithPassword, signOut, signUpWithPassword, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
