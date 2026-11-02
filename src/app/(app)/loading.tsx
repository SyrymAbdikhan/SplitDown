import { ui } from "@/lib/ui";

// Generic page skeleton (settings, join) shown instantly on navigation; the group page has its own.
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className={`${ui.skeleton} h-9 w-40`} />
      <div className={`${ui.card} space-y-3 p-6`}>
        <div className={`${ui.skeleton} h-5 w-24`} />
        <div className={`${ui.skeleton} h-4 w-2/3`} />
        <div className={`${ui.skeleton} h-9`} />
        <div className={`${ui.skeleton} h-9`} />
      </div>
    </div>
  );
}
