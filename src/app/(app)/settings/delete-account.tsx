"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { errMsg, ui } from "@/lib/ui";

export function DeleteAccount({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_account");
    if (error) {
      setBusy(false);
      return setError(errMsg(error));
    }
    await supabase.storage.from("avatars").remove([`${userId}/avatar`]); // best effort; the profile no longer points to it
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <button className={ui.btnDanger} onClick={() => (setError(null), setOpen(true))}>
        <Trash2 size={16} /> Delete account
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <div className={`space-y-3 text-sm ${ui.muted}`}>
          <p>Your login, email, name and photo are deleted. This can&apos;t be undone.</p>
          <p>
            Expenses and payments you shared with others stay in their groups as <b className="text-neutral-900 dark:text-white">Deleted user</b>, so
            their balances still add up. Groups where you&apos;re the only member are deleted.
          </p>
        </div>
        {error && <p className={`${ui.error} mt-4`}>{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className={ui.btnOutline} onClick={() => setOpen(false)}>Cancel</button>
          <button className={`${ui.btnDanger} bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white`} onClick={remove} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Delete my account
          </button>
        </div>
      </Modal>
    </>
  );
}
