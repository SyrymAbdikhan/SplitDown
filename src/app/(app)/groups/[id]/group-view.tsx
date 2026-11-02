"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, Scissors } from "lucide-react";
import { Avatar, Modal } from "@/components/kit";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type Activity, type Expense, type Group, type Member, type Profile, type Settlement } from "@/lib/types";
import { errMsg, ui } from "@/lib/ui";
import { ago, dayLabel, fmtDate, type Ctx } from "./ctx";
import { ExpenseForm } from "./expense-form";
import { HistoryTab } from "./history";
import { InviteModal, MembersTab } from "./members";

type Data = {
  group: Group;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  activity: Activity[];
  transfers: { from_user: string; to_user: string; amount_cents: number }[];
};
/** Shape returned by the group_page() database function. */
export type GroupPage = Data & { profiles: Profile[] };

const TABS = ["Expenses", "History", "Settings", "Activity"] as const;
const byId = (ps: Profile[]) => Object.fromEntries(ps.map((p) => [p.id, p]));

// The server renders the first load; realtime refreshes reuse the same single call.
export function GroupView({ groupId, userId, initial }: { groupId: string; userId: string; initial: GroupPage | "gone" }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Data | "gone">(initial);
  const [profiles, setProfiles] = useState<Record<string, Profile>>(initial === "gone" ? {} : byId(initial.profiles));
  const [tab, setTab] = useState<(typeof TABS)[number]>("Expenses");
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [inviting, setInviting] = useState(false);

  const showToast = useCallback((msg: string, error?: boolean) => {
    setToast({ msg, error });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 3500);
  }, []);

  const load = useCallback(async () => {
    const { data: page, error } = await supabase.rpc("group_page", { p_group: groupId });
    if (error) return error.message.includes("not a member") ? setData("gone") : showToast(errMsg(error), true);
    setProfiles(byId((page as GroupPage).profiles));
    setData(page as GroupPage);
  }, [supabase, groupId, showToast]);

  // Every write adds an activity row, so one subscription keeps the page live.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`group:${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter: `group_id=eq.${groupId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 250);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, groupId, load]);

  if (data === "gone")
    return (
      <div className={`${ui.card} mx-auto mt-12 max-w-sm p-8 text-center`}>
        <span className="text-5xl">🚪</span>
        <h1 className="mt-4 text-xl font-bold">Group not available</h1>
        <p className={`mt-1 mb-6 text-sm ${ui.muted}`}>It was deleted, or you&apos;re no longer a member.</p>
        <Link href="/dashboard" className={`${ui.btnOutline} w-full`}>Back to your groups</Link>
      </div>
    );

  const { group, members } = data;
  const role = members.find((m) => m.user_id === userId)?.role ?? "member";
  const ctx: Ctx = {
    group,
    userId,
    role,
    isAdmin: role !== "member",
    members,
    profiles,
    name: (id) => {
      if (id === userId) return "You";
      const p = id ? profiles[id] : undefined;
      return p ? (p.handle ? p.display_name : `${p.display_name} (guest)`) : "Someone";
    },
    money: (c) => formatMoney(c, group.currency),
    run: async (op, success) => {
      const { error } = await op;
      if (error) {
        showToast(errMsg(error), true);
        return false;
      }
      if (success) showToast(success);
      await load();
      return true;
    },
  };

  // Desktop: left column = title, tabs (each tab holds its own actions); right column = summary spanning the full height.
  // Mobile: title, summary, tabs (DOM order).
  return (
    <>
      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr]">
        <header className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-neutral-100 text-3xl dark:bg-neutral-800">{group.emoji}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={ui.chip}>{group.currency}</span>
                <button onClick={() => setTab("Settings")} className="flex -space-x-1.5" title="Members and settings">
                  {members.slice(0, 6).map((m) => <Avatar key={m.user_id} profile={profiles[m.user_id]} size={22} />)}
                </button>
                <span className={`text-xs ${ui.muted}`}>{members.length} member{members.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        </header>

        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Summary ctx={ctx} expenses={data.expenses} transfers={data.transfers} />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${tab === t ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white" : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}
              >
                {t}
                {t === "Expenses" && data.expenses.length > 0 && <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">{data.expenses.length}</span>}
              </button>
            ))}
          </div>
          {tab === "Expenses" && <ExpensesTab ctx={ctx} expenses={data.expenses} lastSplit={data.settlements[0]?.created_at} onOpen={setEditing} />}
          {tab === "History" && <HistoryTab ctx={ctx} settlements={data.settlements} />}
          {tab === "Settings" && <MembersTab ctx={ctx} onInvite={() => setInviting(true)} />}
          {tab === "Activity" && <ActivityTab ctx={ctx} activity={data.activity} />}
        </div>
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add expense" : "Edit expense"} wide>
        {editing && <ExpenseForm ctx={ctx} expense={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
      {ctx.isAdmin && <InviteModal ctx={ctx} open={inviting} onClose={() => setInviting(false)} />}

      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${toast.error ? "bg-red-600 text-white" : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

function Summary({ ctx, expenses, transfers }: { ctx: Ctx; expenses: Expense[]; transfers: Data["transfers"] }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);

  // Net per person this period: paid minus share.
  const net: Record<string, number> = {};
  for (const e of expenses) {
    net[e.paid_by] = (net[e.paid_by] ?? 0) + e.amount_cents;
    for (const p of e.expense_participants) net[p.user_id] = (net[p.user_id] ?? 0) - p.share_cents;
  }
  const people = Object.entries(net).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const mine = net[ctx.userId] ?? 0;

  const byCat: Record<string, number> = {};
  for (const e of expenses) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount_cents;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  async function split() {
    setBusy(true);
    const ok = await ctx.run(createClient().rpc("split_bill", { p_group: ctx.group.id }), "Bill split. See History for payments.");
    setBusy(false);
    if (ok) setConfirm(false);
  }

  return (
    <div className={`${ui.card} p-5`}>
      <div className={`text-xs font-medium tracking-wide uppercase ${ui.muted}`}>Open since last split</div>
      <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{ctx.money(total)}</div>
      <div className={`text-sm ${ui.muted}`}>
        {expenses.length} expense{expenses.length === 1 ? "" : "s"} ·{" "}
        {mine === 0 ? "you're all square" : mine > 0 ? <span className="text-emerald-600 dark:text-emerald-400">you&apos;re owed {ctx.money(mine)}</span> : <span className="text-red-600 dark:text-red-400">you owe {ctx.money(-mine)}</span>}
      </div>

      {transfers.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-sm font-semibold">If you split now</div>
          {transfers.map((t, i) => (
            <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${t.from_user === ctx.userId || t.to_user === ctx.userId ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20" : "border-neutral-200 dark:border-neutral-800"}`}>
              <Avatar profile={ctx.profiles[t.from_user]} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ctx.name(t.from_user)}</div>
                <div className={`flex items-center gap-1 text-xs ${ui.muted}`}>
                  <ArrowRight size={12} className="shrink-0" /> <span className="truncate">pays {t.to_user === ctx.userId ? "you" : ctx.name(t.to_user)}</span>
                </div>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{ctx.money(t.amount_cents)}</span>
            </div>
          ))}
        </div>
      )}

      <button className={`${ui.btnPrimary} mt-5 h-10 w-full`} disabled={!expenses.length} onClick={() => setConfirm(true)}>
        <Scissors size={16} /> Split the bill
      </button>

      {people.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-semibold select-none">Balances</summary>
          <div className="mt-2 space-y-1.5">
            {people.map(([id, v]) => (
              <div key={id} className="flex items-center gap-2">
                <Avatar profile={ctx.profiles[id]} size={20} />
                <span className="truncate">{ctx.name(id)}</span>
                <span className={`ml-auto font-medium tabular-nums ${v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {v > 0 ? "+" : "−"}{ctx.money(Math.abs(v))}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {cats.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold select-none">By category</summary>
          <div className="mt-2 space-y-2">
            {cats.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-xs">
                  <span>{CATEGORIES[c]?.emoji} {CATEGORIES[c]?.label}</span>
                  <span className="tabular-nums">{ctx.money(v)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${(v / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Split the bill?">
        <p className={`text-sm ${ui.muted}`}>
          This closes the current period: <b className="text-neutral-900 dark:text-white">{expenses.length} expenses</b> totalling{" "}
          <b className="text-neutral-900 dark:text-white">{ctx.money(total)}</b> will be locked and can&apos;t be edited again. New expenses start a fresh period.
        </p>
        <p className={`mt-3 text-sm ${ui.muted}`}>
          {transfers.length ? `${transfers.length} payment${transfers.length === 1 ? "" : "s"} will settle everyone up.` : "Everyone is already square, so no payments are needed."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className={ui.btnOutline} onClick={() => setConfirm(false)}>Cancel</button>
          <button className={ui.btnPrimary} onClick={split} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Split and lock
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ExpensesTab({ ctx, expenses, lastSplit, onOpen }: { ctx: Ctx; expenses: Expense[]; lastSplit?: string; onOpen: (e: Expense | "new") => void }) {
  if (!expenses.length)
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
        <span className="text-4xl">🧾</span>
        <h3 className="mt-3 font-semibold">No open expenses</h3>
        <p className={`mt-1 mb-5 text-sm ${ui.muted}`}>{lastSplit ? `Everything up to ${fmtDate(lastSplit)} is settled.` : "Add the first one and it'll show up for everyone."}</p>
        <button className={ui.btnPrimary} onClick={() => onOpen("new")}>
          <Plus size={16} /> Add expense
        </button>
      </div>
    );

  const days: [string, Expense[]][] = [];
  for (const e of expenses) {
    const day = new Date(e.spent_at).toDateString();
    if (days.at(-1)?.[0] === day) days.at(-1)![1].push(e);
    else days.push([day, [e]]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className={`text-xs ${ui.muted}`}>{lastSplit ? `Since the last split on ${fmtDate(lastSplit, true)}` : "Everything since the group started"}</p>
        <button className={ui.btnPrimary} onClick={() => onOpen("new")}>
          <Plus size={16} /> Add expense
        </button>
      </div>
      {days.map(([day, list]) => (
        <section key={day}>
          <h3 className={`mb-1.5 text-xs font-semibold tracking-wide uppercase ${ui.muted}`}>
            {dayLabel(list[0].spent_at)}
          </h3>
          <div className={`${ui.card} divide-y divide-neutral-100 dark:divide-neutral-800`}>
            {list.map((e) => <ExpenseRow key={e.id} ctx={ctx} e={e} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExpenseRow({ ctx, e, onOpen }: { ctx: Ctx; e: Expense; onOpen: (e: Expense) => void }) {
  const canEdit = e.created_by === ctx.userId || ctx.isAdmin;
  const myShare = e.expense_participants.find((p) => p.user_id === ctx.userId)?.share_cents ?? 0;
  const iPaid = e.paid_by === ctx.userId;
  const guests = e.expense_participants.filter((p) => ctx.profiles[p.user_id]?.handle === null).length;
  const n = e.expense_participants.length - guests;
  const everyone = n === ctx.members.length && ctx.members.every((m) => e.expense_participants.some((p) => p.user_id === m.user_id));
  const who = [everyone ? "everyone" : n ? `${n} ${n === 1 ? "person" : "people"}` : "", guests ? `${guests} guest${guests === 1 ? "" : "s"}` : ""].filter(Boolean).join(" + ");

  return (
    <button
      disabled={!canEdit}
      onClick={() => onOpen(e)}
      title={canEdit ? "Edit" : "Only the author or an admin can edit"}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition enabled:hover:bg-neutral-50 disabled:cursor-default dark:enabled:hover:bg-neutral-800/50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-neutral-100 text-lg dark:bg-neutral-800">{CATEGORIES[e.category]?.emoji ?? "📦"}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{e.title}</div>
        <div className={`truncate text-xs ${ui.muted}`}>
          {ctx.name(e.paid_by)} paid · {who} ·{" "}
          {new Date(e.spent_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums">{ctx.money(e.amount_cents)}</div>
        <div className="text-xs tabular-nums">
          {iPaid && e.amount_cents - myShare > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">you lent {ctx.money(e.amount_cents - myShare)}</span>
          ) : !iPaid && myShare > 0 ? (
            <span className="text-red-600 dark:text-red-400">you owe {ctx.money(myShare)}</span>
          ) : (
            <span className={ui.muted}>not involved</span>
          )}
        </div>
      </div>
    </button>
  );
}

function ActivityTab({ ctx, activity }: { ctx: Ctx; activity: Activity[] }) {
  const d = (a: Activity) => a.details as Record<string, string & number>;
  const text = (a: Activity) => {
    const x = d(a);
    switch (a.action) {
      case "group_created": return <>created the group</>;
      case "group_updated": return <>renamed the group to “{x.name}”</>;
      case "expense_added": return <>added “{x.title}” · {ctx.money(x.amount)}</>;
      case "expense_edited": return <>edited “{x.title}”{x.old_amount !== x.amount && <> · {ctx.money(x.old_amount)} → {ctx.money(x.amount)}</>}</>;
      case "expense_deleted": return <>deleted “{x.title}” · {ctx.money(x.amount)}</>;
      case "bill_split": return <>split the bill: {x.count} expenses · {ctx.money(x.total)}</>;
      case "transfer_paid": return <>marked {ctx.name(x.from)} → {ctx.name(x.to)} {ctx.money(x.amount)} as {x.paid ? "paid" : "unpaid"}</>;
      case "member_invited": return <>invited {ctx.name(x.user)}</>;
      case "member_joined": return <>joined the group{x.via === "link" && " via link"}</>;
      case "member_left": return <>left the group</>;
      case "member_removed": return <>removed {ctx.name(x.user)}</>;
      case "role_changed": return <>made {ctx.name(x.user)} {x.role === "admin" ? "an admin" : "a member"}</>;
      case "ownership_transferred": return <>made {ctx.name(x.user)} the owner</>;
      default: return <>{a.action}</>;
    }
  };
  return (
    <div className={`${ui.card} divide-y divide-neutral-100 dark:divide-neutral-800`}>
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
          <Avatar profile={a.actor_id ? ctx.profiles[a.actor_id] : undefined} size={26} />
          <div className="min-w-0 flex-1">
            <b className="font-medium">{ctx.name(a.actor_id)}</b> {text(a)}
          </div>
          <time className={`shrink-0 text-xs ${ui.muted}`} title={fmtDate(a.created_at, true)}>{ago(a.created_at)}</time>
        </div>
      ))}
    </div>
  );
}
