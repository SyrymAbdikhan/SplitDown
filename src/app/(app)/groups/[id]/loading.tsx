import { ui } from "@/lib/ui";

const s = ui.skeleton;

// Same grid as GroupView, so the page doesn't jump when the data arrives.
export default function Loading() {
  return (
    <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr]" aria-busy="true">
      <span className="sr-only">Loading group…</span>
      <header className="flex items-center gap-4 lg:col-start-1 lg:row-start-1">
        <span className={`${s} size-14 rounded-2xl`} />
        <div className="space-y-2">
          <div className={`${s} h-8 w-44`} />
          <div className={`${s} h-5 w-32`} />
        </div>
      </header>

      <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className={`${ui.card} space-y-3 p-5`}>
          <div className={`${s} h-3 w-32`} />
          <div className={`${s} h-9 w-44`} />
          <div className={`${s} h-4 w-48`} />
          <div className="space-y-2 pt-3">
            {[0, 1, 2].map((i) => <div key={i} className={`${s} h-14 rounded-lg`} />)}
          </div>
          <div className={`${s} h-10 rounded-lg`} />
        </div>
      </aside>

      <div className="space-y-4 lg:col-start-1 lg:row-start-2">
        <div className="flex gap-6 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${s} h-5 w-16`} />)}
        </div>
        <div className="flex items-center justify-between">
          <div className={`${s} h-4 w-48`} />
          <div className={`${s} h-9 w-32 rounded-lg`} />
        </div>
        <div className={`${ui.card} divide-y divide-neutral-100 dark:divide-neutral-800`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className={`${s} size-10 rounded-lg`} />
              <div className="flex-1 space-y-2">
                <div className={`${s} h-4 w-1/3`} />
                <div className={`${s} h-3 w-1/2`} />
              </div>
              <div className="space-y-2">
                <div className={`${s} ml-auto h-4 w-20`} />
                <div className={`${s} h-3 w-16`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
