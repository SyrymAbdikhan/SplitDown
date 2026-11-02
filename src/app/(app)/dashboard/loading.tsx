import { DashboardHeader, GroupsSkeleton } from "./parts";

export default function Loading() {
  return (
    <div className="space-y-8">
      <DashboardHeader />
      <GroupsSkeleton />
    </div>
  );
}
