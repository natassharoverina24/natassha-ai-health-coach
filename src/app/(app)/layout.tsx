"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Route guard for every authenticated page. Firebase Auth state only
 * resolves client-side, so the guard lives here rather than in Next.js
 * middleware (which has no access to the Firebase SDK's session).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, authInitializing, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authInitializing && !loading && !user) router.replace("/login");
  }, [authInitializing, loading, user, router]);

  if (authInitializing || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size={28} />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
