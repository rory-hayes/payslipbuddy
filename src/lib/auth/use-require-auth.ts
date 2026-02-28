"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/auth?next=${next}`);
    }
  }, [auth.loading, auth.user, pathname, router]);

  return auth;
}
