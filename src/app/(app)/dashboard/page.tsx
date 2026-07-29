import { PlannerNavigationCard } from "@/components/dashboard/PlannerNavigationCard";
import { TodayDashboard } from "@/components/today";

export default function DashboardPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TodayDashboard />
      <PlannerNavigationCard />
    </div>
  );
}
