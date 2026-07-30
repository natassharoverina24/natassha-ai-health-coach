"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

export default function RootPage() {
  const { user, authInitializing, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authInitializing || loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [authInitializing, loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Spinner size={28} />
    </div>
  );
}
