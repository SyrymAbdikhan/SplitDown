"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Lock } from "lucide-react";
import { Avatar } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type Expense, type Settlement } from "@/lib/types";
import { ui } from "@/lib/ui";
import { fmtDate, type Ctx } from "./ctx";

export function HistoryTab({ ctx, settlements }: { ctx: Ctx; settlements: Settlement[] }) {
  if (!settlements.length)
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
        <span className="text-4xl">🗂️</span>
        <h3 className="mt-3 font-semibold">No splits yet</h3>
        <p className={`mt-1 text-sm ${ui.muted}`}>When someone hits “Split the bill”, the period and its payments show up here.</p>
      </div>
    );
  return <div className="space-y-4">{settlements.map((s) => <SettlementCard key={s.id} ctx={ctx} s={s} />)}</div>;
}

function SettlementCard({ ctx, s }: { ctx: Ctx; s: Settlement }) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [open, setOpen] = useState(false);
  const unpaid = s.settlement_transfers.filter((t) => !t.paid_at).length;

  async function toggle() {
    setOpen(!open);
    if (expenses) return;
    const { data } = await createClient()
      .from("expenses")
      .select("id, title, amount_cents, category, paid_by, created_by, spent_at, settlement_id, expense_participants(user_id, share_cents)")
      .eq("settlement_id", s.id)
      .order("spent_at", { ascending: false });
    setExpenses((data ?? []) as Expense[]);
  }

  return (
    <div className={ui.card}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
        <Lock size={15} className="text-neutral-400" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{fmtDate(s.created_at, true)}</div>
          <div className={`text-xs ${ui.muted}`}>Split by {ctx.name(s.created_by)} · {s.expense_count} expense{s.expense_count === 1 ? "" : "s"}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{ctx.money(s.total_cents)}</div>
          <div className={`text-xs ${unpaid ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {s.settlement_transfers.length === 0 ? "No payments needed" : unpaid ? `${unpaid} unpaid` : "All paid"}
          </div>
        </div>
      </div>

      {s.settlement_transfers.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {s.settlement_transfers.map((t) => {
            const mine = t.from_user === ctx.userId || t.to_user === ctx.userId;
            const canMark = mine || ctx.isAdmin;
            return (
              <div key={t.id} className="flex items-center gap-2.5 px-5 py-3 text-sm">
                <Avatar profile={ctx.profiles[t.from_user]} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ctx.name(t.from_user)}</div>
                  <div className={`flex items-center gap-1 text-xs ${ui.muted}`}>
                    <ArrowRight size={12} className="shrink-0" /> <span className="truncate">pays {t.to_user === ctx.userId ? "you" : ctx.name(t.to_user)}</span>
                  </div>
                </div>
                <span className={`shrink-0 font-semibold tabular-nums ${t.paid_at ? "text-neutral-400 line-through" : ""}`}>{ctx.money(t.amount_cents)}</span>
                {canMark ? (
                  <button
                    onClick={() => ctx.run(createClient().rpc("set_transfer_paid", { p_transfer: t.id, p_paid: !t.paid_at }), t.paid_at ? "Marked unpaid" : "Marked paid")}
                    className={`ml-2 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition ${t.paid_at ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"}`}
                  >
                    {t.paid_at ? <><Check size={13} /> Paid</> : "Mark paid"}
                  </button>
                ) : (
                  <span className={`ml-2 w-16 text-right text-xs ${t.paid_at ? "text-emerald-600" : ui.muted}`}>{t.paid_at ? "Paid" : "Pending"}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={toggle} className={`flex w-full items-center gap-1 border-t border-neutral-100 px-5 py-2.5 text-xs font-medium dark:border-neutral-800 ${ui.muted} hover:text-neutral-900 dark:hover:text-white`}>
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} /> {open ? "Hide" : "Show"} expenses
      </button>
      {open && (
        <div className="divide-y divide-neutral-100 border-t border-neutral-100 bg-neutral-50/50 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950/30">
          {expenses === null ? (
            <div className={`px-5 py-3 text-sm ${ui.muted}`}>Loading…</div>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span>{CATEGORIES[e.category]?.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className={`hidden text-xs sm:inline ${ui.muted}`}>{ctx.name(e.paid_by)} · {fmtDate(e.spent_at)}</span>
                <span className="font-medium tabular-nums">{ctx.money(e.amount_cents)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
