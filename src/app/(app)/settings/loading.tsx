import { ui } from "@/lib/ui";

// Settings skeleton. Each page keeps its own loading screen, so none flashes on the wrong page.
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
