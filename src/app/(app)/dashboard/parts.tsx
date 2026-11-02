import { ui } from "@/lib/ui";
import { NewGroupButton } from "./dashboard-client";

// Shared by the page and its loading screen, so navigating here shows the real heading at once.
export function DashboardHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your groups</h1>
        <p className={`mt-1 ${ui.muted}`}>Balances show what&apos;s open since each group&apos;s last split.</p>
      </div>
      <NewGroupButton />
    </div>
  );
}

export function GroupsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <span className="sr-only">Loading groups…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${ui.card} p-5`}>
          <div className="flex items-center gap-3">
            <span className={`${ui.skeleton} size-11 rounded-xl`} />
            <div className="flex-1 space-y-2">
              <div className={`${ui.skeleton} h-4 w-2/3`} />
              <div className={`${ui.skeleton} h-3 w-1/3`} />
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div className="space-y-2">
              <div className={`${ui.skeleton} h-3 w-16`} />
              <div className={`${ui.skeleton} h-4 w-24`} />
            </div>
            <div className={`${ui.skeleton} h-4 w-20`} />
          </div>
        </div>
      ))}
    </div>
  );
}
