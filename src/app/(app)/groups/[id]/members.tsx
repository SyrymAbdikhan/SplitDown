"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, Link2, Loader2, LogOut, Search, Shield, UserPlus, X } from "lucide-react";
import { Avatar, EmojiPicker, Modal } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { ui } from "@/lib/ui";
import { ago, fmtDate, type Ctx } from "./ctx";

const sb = createClient;

export function MembersTab({ ctx, onInvite }: { ctx: Ctx; onInvite: () => void }) {
  const router = useRouter();
  const [invites, setInvites] = useState<{ id: string; invitee_id: string; created_at: string; profile: Profile }[]>([]);
  const [name, setName] = useState(ctx.group.name);
  const [emoji, setEmoji] = useState(ctx.group.emoji);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: () => Promise<unknown>; danger?: boolean }>(null);
  const isOwner = ctx.role === "owner";

  const loadInvites = useCallback(async () => {
    if (!ctx.isAdmin) return;
    const { data } = await sb()
      .from("group_invites")
      .select("id, invitee_id, created_at, profile:profiles!group_invites_invitee_id_fkey(id, handle, display_name, avatar_url)")
      .eq("group_id", ctx.group.id);
    setInvites((data ?? []) as unknown as typeof invites);
  }, [ctx.isAdmin, ctx.group.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state is set after it resolves
  useEffect(() => void loadInvites(), [loadInvites, ctx.members]);

  const ask = (title: string, body: string, action: () => Promise<unknown>, danger = true) => setConfirm({ title, body, action, danger });

  return (
    <div className="space-y-6">
      <section className={ui.card}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
          <h3 className="font-semibold">Members · {ctx.members.length}</h3>
          {ctx.isAdmin && (
            <button className={ui.btnOutline} onClick={onInvite}>
              <UserPlus size={16} /> Invite
            </button>
          )}
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {ctx.members.map((m) => {
            const p = ctx.profiles[m.user_id];
            const me = m.user_id === ctx.userId;
            const canRemove = !me && m.role !== "owner" && (isOwner || (ctx.role === "admin" && m.role === "member"));
            return (
              <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar profile={p} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p?.display_name}{me && <span className={ui.muted}> (you)</span>}</div>
                  <div className={`text-xs ${ui.muted}`}>@{p?.handle} · joined {fmtDate(m.joined_at)}</div>
                </div>
                {m.role !== "member" && (
                  <span className={`${ui.chip} ${m.role === "owner" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"}`}>
                    {m.role === "owner" ? <Crown size={11} /> : <Shield size={11} />} {m.role}
                  </span>
                )}
                <div className="flex gap-1">
                  {isOwner && !me && (
                    <>
                      <button
                        className={`${ui.btnGhost} h-8 px-2.5 text-xs`}
                        onClick={() => ctx.run(sb().rpc("set_member_role", { p_group: ctx.group.id, p_user: m.user_id, p_role: m.role === "admin" ? "member" : "admin" }), "Role updated")}
                      >
                        {m.role === "admin" ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        className={`${ui.btnGhost} h-8 px-2.5 text-xs`}
                        onClick={() => ask("Transfer ownership?", `${p?.display_name} becomes the owner and you become an admin.`, () => ctx.run(sb().rpc("transfer_ownership", { p_group: ctx.group.id, p_user: m.user_id }), "Ownership transferred"), false)}
                      >
                        Make owner
                      </button>
                    </>
                  )}
                  {canRemove && (
                    <button
                      className={`${ui.btnGhost} h-8 px-2.5 text-xs text-red-600 dark:text-red-400`}
                      onClick={() => ask(`Remove ${p?.display_name}?`, "They'll lose access to this group. Their past expenses stay in history.", () => ctx.run(sb().rpc("remove_member", { p_group: ctx.group.id, p_user: m.user_id }), "Member removed"))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {invites.length > 0 && (
        <section className={ui.card}>
          <h3 className="border-b border-neutral-100 px-5 py-3 font-semibold dark:border-neutral-800">Pending invites</h3>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Avatar profile={i.profile} size={28} />
                <span className="flex-1 truncate">{i.profile?.display_name} <span className={ui.muted}>@{i.profile?.handle} · {ago(i.created_at)}</span></span>
                <button className={ui.iconBtn} title="Cancel invite" onClick={async () => (await ctx.run(sb().rpc("cancel_invite", { p_invite: i.id }), "Invite cancelled")) && loadInvites()}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {ctx.isAdmin && (
        <section className={`${ui.card} p-5`}>
          <h3 className="mb-3 font-semibold">Group settings</h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              ctx.run(sb().rpc("update_group", { p_group: ctx.group.id, p_name: name, p_emoji: emoji }), "Group updated");
            }}
          >
            <div>
              <span className={ui.label}>Icon</span>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
            <div>
              <label className={ui.label} htmlFor="group-name">Name</label>
              <input id="group-name" className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <p className={`text-xs ${ui.muted}`}>Currency is fixed at {ctx.group.currency}.</p>
              <button className={ui.btnPrimary} disabled={!name.trim() || (name === ctx.group.name && emoji === ctx.group.emoji)}>Save</button>
            </div>
          </form>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        {!isOwner && (
          <button
            className={ui.btnDanger}
            onClick={() => ask("Leave this group?", "You can leave once all your expenses are settled. You'll need a new invite to come back.", async () => (await ctx.run(sb().rpc("remove_member", { p_group: ctx.group.id, p_user: ctx.userId }))) && router.push("/dashboard"))}
          >
            <LogOut size={16} /> Leave group
          </button>
        )}
        {isOwner && (
          <button
            className={ui.btnDanger}
            onClick={() => ask("Delete this group?", "This permanently deletes the group, all expenses and history for everyone. This can't be undone.", async () => (await ctx.run(sb().rpc("delete_group", { p_group: ctx.group.id }))) && router.push("/dashboard"))}
          >
            Delete group
          </button>
        )}
      </section>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title ?? ""}>
        <ConfirmBody body={confirm?.body ?? ""} danger={confirm?.danger} onCancel={() => setConfirm(null)} onConfirm={async () => (await confirm?.action(), setConfirm(null))} />
      </Modal>
    </div>
  );
}

function ConfirmBody({ body, danger, onCancel, onConfirm }: { body: string; danger?: boolean; onCancel: () => void; onConfirm: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p className={`text-sm ${ui.muted}`}>{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className={ui.btnOutline} onClick={onCancel}>Cancel</button>
        <button className={danger ? `${ui.btnDanger} bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white` : ui.btnPrimary} disabled={busy} onClick={async () => (setBusy(true), await onConfirm(), setBusy(false))}>
          {busy && <Loader2 size={16} className="animate-spin" />} Confirm
        </button>
      </div>
    </>
  );
}

export function InviteModal({ ctx, open, onClose }: { ctx: Ctx; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<{ token: string; expires_at: string | null } | null | undefined>(undefined);
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    sb().from("group_invite_links").select("token, expires_at").eq("group_id", ctx.group.id).maybeSingle().then(({ data }) => setLink(data));
  }, [open, ctx.group.id]);

  // Debounced handle / name search. Strip PostgREST filter syntax from the query.
  const term = q.trim().replace(/^@/, "").replace(/[^\p{L}\p{N}_ ]/gu, "");
  const shown = term.length >= 2 ? results : [];
  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await sb()
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .not("handle", "is", null)
        .or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(8);
      setResults((data ?? []).filter((p) => !ctx.members.some((m) => m.user_id === p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [term, ctx.members]);

  const url = link ? `${location.origin}/join/${link.token}` : "";
  const expired = link?.expires_at && new Date(link.expires_at) < new Date();

  async function makeLink() {
    const { data, error } = await sb().rpc("create_invite_link", { p_group: ctx.group.id, p_expires_days: days });
    if (!error) setLink({ token: data, expires_at: days ? new Date(Date.now() + days * 864e5).toISOString() : null });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Invite to ${ctx.group.name}`}>
      <div className="space-y-6">
        <div>
          <label className={ui.label} htmlFor="search">Find by handle or name</label>
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
            <input id="search" className={`${ui.input} pl-9`} placeholder="@handle" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          {shown.length > 0 && (
            <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {shown.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Avatar profile={p} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.display_name}</div>
                    <div className={`text-xs ${ui.muted}`}>@{p.handle}</div>
                  </div>
                  {invited.has(p.id) ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><Check size={14} /> Invited</span>
                  ) : (
                    <button
                      className={`${ui.btnOutline} h-8 px-3 text-xs`}
                      onClick={async () => (await ctx.run(sb().rpc("invite_member", { p_group: ctx.group.id, p_user: p.id }), `Invited @${p.handle}`)) && setInvited(new Set(invited).add(p.id))}
                    >
                      Invite
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {term.length >= 2 && !shown.length && <p className={`mt-2 text-xs ${ui.muted}`}>No one found. Share a link instead.</p>}
        </div>

        <div className="border-t border-neutral-100 pt-5 dark:border-neutral-800">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Link2 size={16} /> Invite link</div>
          {link && !expired ? (
            <>
              <div className="flex gap-2">
                <input id="invite-url" className={`${ui.input} font-mono text-xs`} readOnly value={url} onFocus={(e) => e.target.select()} />
                <button
                  className={ui.btnPrimary}
                  onClick={() =>
                    // The clipboard API only exists on HTTPS (and localhost); elsewhere select the link for a manual copy.
                    navigator.clipboard
                      ? navigator.clipboard.writeText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)))
                      : (document.getElementById("invite-url") as HTMLInputElement).select()
                  }
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className={`mt-2 flex items-center justify-between text-xs ${ui.muted}`}>
                <span>{link.expires_at ? `Expires ${ago(link.expires_at)}` : "Never expires"} · anyone with the link can join</span>
                <span className="flex gap-3">
                  <button className="font-medium hover:text-neutral-900 dark:hover:text-white" onClick={makeLink}>Regenerate</button>
                  <button className="font-medium text-red-600 hover:underline" onClick={async () => (await sb().rpc("revoke_invite_link", { p_group: ctx.group.id }), setLink(null))}>Revoke</button>
                </span>
              </div>
            </>
          ) : link !== undefined ? (
            <div className="flex gap-2">
              <select className={`${ui.input} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Link expiry">
                <option value={1}>Expires in 1 day</option>
                <option value={7}>Expires in 7 days</option>
                <option value={30}>Expires in 30 days</option>
                <option value={0}>Never expires</option>
              </select>
              <button className={`${ui.btnDark} flex-1`} onClick={makeLink}>Create link</button>
            </div>
          ) : (
            <Loader2 size={16} className="animate-spin text-neutral-400" />
          )}
        </div>
      </div>
    </Modal>
  );
}
