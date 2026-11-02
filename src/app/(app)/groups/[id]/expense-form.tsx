"use client";

import { useState } from "react";
import { Check, Loader2, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/kit";
import { formatMoney, parseMoney, toInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type Expense } from "@/lib/types";
import { ui } from "@/lib/ui";
import type { Ctx } from "./ctx";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function ExpenseForm({ ctx, expense, onDone }: { ctx: Ctx; expense: Expense | null; onDone: () => void }) {
  const cur = ctx.group.currency;
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? toInput(expense.amount_cents, cur) : "");
  const [category, setCategory] = useState(expense?.category ?? "food");
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? ctx.userId);
  const [when, setWhen] = useState(toLocalInput(expense ? new Date(expense.spent_at) : new Date()));
  const isMember = (id: string) => ctx.members.some((m) => m.user_id === id);
  const [who, setWho] = useState<Set<string>>(
    new Set(expense ? expense.expense_participants.map((p) => p.user_id).filter(isMember) : ctx.members.map((m) => m.user_id)),
  );
  // Guests are just names; saving re-creates them for this expense.
  const [guests, setGuests] = useState<string[]>(
    expense ? expense.expense_participants.filter((p) => !isMember(p.user_id)).map((p) => ctx.profiles[p.user_id]?.display_name ?? "Guest") : [],
  );
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cents = parseMoney(amount, cur);
  const people = who.size + guests.length;
  const each = cents && people ? Math.floor(cents / people) : 0;
  const addGuest = () => {
    const g = guestName.trim();
    if (g && guests.length < 20) setGuests([...guests, g]);
    setGuestName("");
  };
  const allOn = who.size === ctx.members.length;

  const toggle = (id: string) => setWho((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cents || !people) return;
    setBusy("save");
    const ok = await ctx.run(
      createClient().rpc("save_expense", {
        p_group: ctx.group.id,
        p_id: expense?.id ?? null,
        p_title: title,
        p_amount_cents: cents,
        p_category: category,
        p_paid_by: paidBy,
        p_spent_at: new Date(when).toISOString(),
        p_participants: [...who],
        p_guests: guests,
      }),
      expense ? "Expense updated" : "Expense added",
    );
    setBusy(null);
    if (ok) onDone();
  }

  async function remove() {
    setBusy("delete");
    const ok = await ctx.run(createClient().rpc("delete_expense", { p_id: expense!.id }), "Expense deleted");
    setBusy(null);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div>
          <label className={ui.label} htmlFor="title">What was it?</label>
          <input id="title" className={ui.input} placeholder="Dinner, taxi, groceries…" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required autoFocus />
        </div>
        <div>
          <label className={ui.label} htmlFor="amount">Amount</label>
          <div className="relative">
            <input id="amount" className={`${ui.input} pr-12 text-right font-semibold tabular-nums`} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-neutral-400">{cur}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={ui.label} htmlFor="cat">Category</label>
          <select id="cat" className={ui.input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={ui.label} htmlFor="paid">Paid by</label>
          <select id="paid" className={ui.input} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {ctx.members.map((m) => <option key={m.user_id} value={m.user_id}>{ctx.name(m.user_id)}</option>)}
          </select>
        </div>
        <div>
          <label className={ui.label} htmlFor="when">When</label>
          <input id="when" type="datetime-local" className={ui.input} value={when} onChange={(e) => setWhen(e.target.value)} required />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">Split equally between</span>
          <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setWho(new Set(allOn ? [] : ctx.members.map((m) => m.user_id)))}>
            {allOn ? "Clear" : "Select all"}
          </button>
        </div>
        <div className="max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {ctx.members.map((m) => {
            const on = who.has(m.user_id);
            return (
              <label key={m.user_id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(m.user_id)} />
                <span className={`grid size-4.5 place-items-center rounded border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300 dark:border-neutral-600"}`}>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <Avatar profile={ctx.profiles[m.user_id]} size={22} />
                <span className="flex-1 truncate">{ctx.name(m.user_id)}</span>
                <span className={`tabular-nums ${on ? "" : "text-neutral-300 dark:text-neutral-600"}`}>{on && each ? formatMoney(each, cur) : "—"}</span>
              </label>
            );
          })}
          {guests.map((g, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="grid size-4.5 place-items-center rounded border border-blue-600 bg-blue-600 text-white"><Check size={12} strokeWidth={3} /></span>
              <span className="grid size-[22px] place-items-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800">{g.charAt(0).toUpperCase()}</span>
              <span className="flex-1 truncate">{g} <span className={`text-xs ${ui.muted}`}>guest</span></span>
              <span className="tabular-nums">{each ? formatMoney(each, cur) : "—"}</span>
              <button type="button" onClick={() => setGuests(guests.filter((_, j) => j !== i))} className="rounded p-0.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white" aria-label={`Remove ${g}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <UserPlus size={16} className="shrink-0 text-neutral-400" />
            <input
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              placeholder="Add a guest without an account…"
              value={guestName}
              maxLength={50}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuest())}
            />
            {guestName.trim() && (
              <button type="button" onClick={addGuest} className="text-xs font-medium text-blue-600 hover:underline">Add</button>
            )}
          </div>
        </div>
        {!people && <p className="mt-1.5 text-xs text-red-600">Pick at least one person.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {expense && (
          confirmDelete ? (
            <button type="button" className={ui.btnDanger} onClick={remove} disabled={busy !== null}>
              {busy === "delete" && <Loader2 size={16} className="animate-spin" />} Confirm delete
            </button>
          ) : (
            <button type="button" className={ui.iconBtn} onClick={() => setConfirmDelete(true)} aria-label="Delete expense" title="Delete">
              <Trash2 size={17} />
            </button>
          )
        )}
        {/* Cancel + Save stay together; on narrow screens they wrap below the delete button. */}
        <div className="ml-auto flex gap-2">
          <button type="button" className={ui.btnOutline} onClick={onDone}>Cancel</button>
          <button className={ui.btnPrimary} disabled={busy !== null || !cents || !people || !title.trim()}>
            {busy === "save" && <Loader2 size={16} className="animate-spin" />} {expense ? "Save changes" : "Add expense"}
          </button>
        </div>
      </div>
    </form>
  );
}
