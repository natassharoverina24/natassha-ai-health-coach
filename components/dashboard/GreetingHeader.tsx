import { Avatar } from "@/components/ui/Avatar";
import { greetingForHour } from "@/lib/utils/format";

export interface GreetingHeaderProps {
  name: string;
  photoURL?: string | null;
  subtitle?: string;
}

export function GreetingHeader({ name, photoURL, subtitle }: GreetingHeaderProps) {
  const greeting = greetingForHour(new Date().getHours());
  const firstName = name.split(" ")[0] || name;

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-ink-muted">{greeting},</p>
        <h1 className="text-2xl font-bold text-ink">{firstName} 👋</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <Avatar name={name} src={photoURL} size={48} />
    </div>
  );
}
