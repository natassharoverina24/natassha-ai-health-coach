"use client";

import { LogOut, Moon, Sun, SunMoon, WifiOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

const THEME_CYCLE = ["light", "dark", "system"] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: SunMoon };

/** Top utility bar: connectivity indicator, theme toggle, account menu. Shown on all breakpoints. */
export function TopBar({ title }: { title?: string }) {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const ThemeIcon = THEME_ICON[theme];

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <header className="flex items-center justify-between gap-3 px-1 py-2">
      <div className="flex items-center gap-2">
        {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
        {!isOnline && (
          <span className="flex items-center gap-1 rounded-pill bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">
            <WifiOff size={12} /> Offline — changes will sync later
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Click to change.`}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-ink/5",
          )}
        >
          <ThemeIcon size={18} />
        </button>

        {profile && <Avatar name={profile.displayName} src={profile.photoURL} size={36} />}

        <button
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
