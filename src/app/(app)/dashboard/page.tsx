import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/supabase/server";
import { ui } from "@/lib/ui";
import { InviteActions, NewGroupButton } from "./dashboard-client";
import { DashboardHeader, GroupsSkeleton } from "./parts";

export const metadata: Metadata = { title: "Your groups" };

type GroupRow = {
  id: string; name: string; emoji: string; currency: string; role: string; member_count: number;
  open_total_cents: number; my_net_cents: number; unpaid_net_cents: number; last_activity: string | null;
};
type InviteRow = { id: string; group_id: string; group_name: string; group_emoji: string; inviter_name: string };

// The heading renders at once; invites and groups each stream in from their own call.
export default function Dashboard() {
  return (
    <div className="space-y-8">
      <DashboardHeader />
      <Suspense>
        <Invites />
      </Suspense>
      <Suspense fallback={<GroupsSkeleton />}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Invites() {
  const { supabase } = await requireUserId();
  const invites = (await supabase.rpc("my_invites")).data as InviteRow[] | null;
  if (!invites?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className={`text-xs font-semibold tracking-wide uppercase ${ui.muted}`}>Invitations</h2>
      {invites.map((i) => (
        <div key={i.id} className={`${ui.card} flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20`}>
          <span className="text-2xl">{i.group_emoji}</span>
          <div className="min-w-0 flex-1 text-sm">
            <b>{i.inviter_name}</b> invited you to <b>{i.group_name}</b>
          </div>
          <InviteActions inviteId={i.id} />
        </div>
      ))}
    </section>
  );
}

async function Groups() {
  const { supabase } = await requireUserId();
  const groups = (await supabase.rpc("my_groups")).data as GroupRow[] | null;
  if (!groups?.length)
    return (
      <div className={`${ui.card} flex flex-col items-center px-6 py-20 text-center`}>
        <span className="text-5xl">🧾</span>
        <h2 className="mt-4 text-lg font-semibold">No groups yet</h2>
        <p className={`mt-1 mb-6 max-w-sm text-sm ${ui.muted}`}>Create a group for your trip, flat or team, then invite people by handle or link.</p>
        <NewGroupButton />
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <Link key={g.id} href={`/groups/${g.id}`} className={`${ui.card} group flex flex-col p-5 transition hover:border-neutral-300 hover:shadow-sm dark:hover:border-neutral-700`}>
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-neutral-100 text-2xl dark:bg-neutral-800">{g.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold group-hover:text-blue-600">{g.name}</div>
              <div className={`flex items-center gap-1 text-xs ${ui.muted}`}>
                <Users size={12} /> {g.member_count} · {g.currency}
                {g.role !== "member" && <span className="ml-1 capitalize">· {g.role}</span>}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-2">
            <div>
              <div className={`text-xs ${ui.muted}`}>Open total</div>
              <div className="font-semibold tabular-nums">{formatMoney(g.open_total_cents, g.currency)}</div>
            </div>
            <Balance cents={g.my_net_cents} currency={g.currency} />
          </div>
          {g.unpaid_net_cents !== 0 && (
            <div className={`mt-3 rounded-lg px-2.5 py-1.5 text-xs font-medium ${g.unpaid_net_cents < 0 ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}`}>
              {g.unpaid_net_cents < 0
                ? `You still need to pay ${formatMoney(-g.unpaid_net_cents, g.currency)} from past splits`
                : `${formatMoney(g.unpaid_net_cents, g.currency)} still owed to you from past splits`}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

function Balance({ cents, currency }: { cents: number; currency: string }) {
  if (cents === 0) return <span className={`text-sm ${ui.muted}`}>All square</span>;
  const owed = cents > 0;
  return (
    <div className="text-right">
      <div className={`text-xs ${ui.muted}`}>{owed ? "You're owed" : "You owe"}</div>
      <div className={`font-semibold tabular-nums ${owed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {formatMoney(Math.abs(cents), currency)}
      </div>
    </div>
  );
}
