"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { firebaseConfigIsPresent } from "@/lib/firebase/config";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/utils/constants";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle, error } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="app-backdrop flex min-h-screen flex-col items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-card p-8 text-center shadow-[var(--shadow-float)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose text-white shadow-[0_10px_24px_-10px_rgba(255,107,157,0.6)]">
          <HeartPulse size={28} />
        </div>
        <h1 className="text-xl font-bold text-ink">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your daily companion for weight, meals, supplements, and progress.
        </p>

        <Button
          className="mt-7 w-full"
          size="lg"
          variant="secondary"
          onClick={() => void handleSignIn()}
          isLoading={signingIn || loading}
          disabled={!firebaseConfigIsPresent}
          leadingIcon={<GoogleIcon />}
        >
          Continue with Google
        </Button>

        {!firebaseConfigIsPresent && (
          <p className="mt-4 text-sm text-amber">
            No Firebase project is configured yet. Copy <code>.env.local.example</code> to{" "}
            <code>.env.local</code> and add your project credentials to enable sign-in.
          </p>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <p className="mt-6 text-xs text-ink-faint">
          By continuing, you agree this app stores your health data securely in your
          own private account.
        </p>
      </div>
    </div>
  );
}
