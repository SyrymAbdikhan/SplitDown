// Shared class strings (neutral + blue, TrueUp-style). Plain strings, no component wrappers.
const btn =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium h-9 px-4 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40";

export const ui = {
  btnPrimary: `${btn} bg-blue-600 text-white hover:bg-blue-700`,
  btnDark: `${btn} bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200`,
  btnOutline: `${btn} border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800`,
  btnGhost: `${btn} hover:bg-neutral-100 dark:hover:bg-neutral-800`,
  btnDanger: `${btn} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40`,
  iconBtn:
    "inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 cursor-pointer",
  input:
    "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-neutral-800 dark:bg-neutral-900",
  label: "mb-1.5 block text-sm font-medium",
  card: "rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
  chip: "inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-xs font-medium dark:border-neutral-800",
  muted: "text-neutral-500 dark:text-neutral-400",
  error: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300",
  skeleton: "animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800",
};

/** Turns a Supabase/Postgres error into a user-facing sentence. */
export const errMsg = (e: unknown) =>
  (e as { message?: string })?.message || "Something went wrong";
