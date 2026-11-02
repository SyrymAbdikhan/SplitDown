"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { EmojiPicker, Modal } from "@/components/kit";
import { CURRENCIES } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { errMsg, ui } from "@/lib/ui";

const guessCurrency = () => {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const c = { KZ: "KZT", RU: "RUB", GB: "GBP", JP: "JPY", TR: "TRY", IN: "INR", CA: "CAD", AU: "AUD", CH: "CHF", PL: "PLN", AE: "AED", UZ: "UZS", KG: "KGS", GE: "GEL", KR: "KRW", CN: "CNY", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR" }[region ?? ""];
    return c ?? "USD";
  } catch {
    return "USD";
  }
};

export function NewGroupButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("create_group", { p_name: name, p_emoji: emoji, p_currency: currency });
    if (error) {
      setBusy(false);
      return setError(errMsg(error));
    }
    router.push(`/groups/${data}`);
  }

  return (
    <>
      <button className={ui.btnPrimary} onClick={() => (setCurrency(guessCurrency()), setOpen(true))}>
        <Plus size={16} /> New group
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New group">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className={ui.label}>Icon</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div>
            <label className={ui.label} htmlFor="gname">Name</label>
            <input id="gname" className={ui.input} placeholder="Ski trip 2026" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
          </div>
          <div>
            <label className={ui.label} htmlFor="gcur">Currency</label>
            <select id="gcur" className={ui.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <p className={`mt-1.5 text-xs ${ui.muted}`}>All expenses in this group use this currency.</p>
          </div>
          {error && <p className={ui.error}>{error}</p>}
          <button className={`${ui.btnPrimary} w-full`} disabled={busy || !name.trim()}>
            {busy && <Loader2 size={16} className="animate-spin" />} Create group
          </button>
        </form>
      </Modal>
    </>
  );
}

export function InviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function respond(accept: boolean) {
    setBusy(true);
    const { data, error } = await createClient().rpc("respond_invite", { p_invite: inviteId, p_accept: accept });
    if (error) {
      setBusy(false);
      return alert(errMsg(error));
    }
    if (accept) router.push(`/groups/${data}`);
    else router.refresh();
  }
  return (
    <div className="flex gap-2">
      <button className={ui.btnOutline} disabled={busy} onClick={() => respond(false)}>Decline</button>
      <button className={ui.btnPrimary} disabled={busy} onClick={() => respond(true)}>Join group</button>
    </div>
  );
}
