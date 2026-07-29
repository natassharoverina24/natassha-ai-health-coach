import { PlannerWorkspace } from "@/components/dashboard/PlannerWorkspace";
import { PageHeader } from "@/components/layout/PageHeader";

export default function PlannerPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Planner"
        description="Daily schedules, approved meals, weekly selections, and deterministic tools."
      />
      <PlannerWorkspace />
    </div>
  );
}
