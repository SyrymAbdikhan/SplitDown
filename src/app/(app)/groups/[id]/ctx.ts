import type { Group, Member, Profile, Role } from "@/lib/types";

/** Everything the group tabs need, passed down from GroupView. */
export type Ctx = {
  group: Group;
  userId: string;
  role: Role;
  isAdmin: boolean;
  members: Member[];
  profiles: Record<string, Profile>;
  name: (id: string | null | undefined) => string;
  money: (cents: number) => string;
  /** Runs a mutation; toasts the error or the success message, then reloads. Resolves true on success. */
  run: (op: PromiseLike<{ error: unknown }>, success?: string) => Promise<boolean>;
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
export function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, sec] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]] as const)
    if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
  return "just now";
}

export function dayLabel(iso: string) {
  const day = new Date(iso).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 864e5).toDateString()) return "Yesterday";
  return fmtDate(iso);
}

export const fmtDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", ...(withTime && { hour: "numeric", minute: "2-digit" }) });
