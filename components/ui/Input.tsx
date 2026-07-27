import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leadingIcon, suffix, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3.5 text-ink-muted">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-12 w-full rounded-control border border-ink/10 bg-bg-elevated px-4 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-rose",
              leadingIcon && "pl-11",
              suffix && "pr-14",
              error && "border-danger focus:border-danger",
              className,
            )}
            aria-invalid={Boolean(error) || undefined}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3.5 text-sm text-ink-muted">{suffix}</span>
          )}
        </div>
        {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
