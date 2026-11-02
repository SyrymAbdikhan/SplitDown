"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errMsg, ui } from "@/lib/ui";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    const { data, error } = await createClient().rpc("join_by_token", { p_token: token });
    if (error) {
      setBusy(false);
      return setError(errMsg(error));
    }
    router.push(`/groups/${data}`);
  }

  return (
    <>
      <button className={`${ui.btnPrimary} w-full`} onClick={join} disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Join group
      </button>
      {error && <p className={`${ui.error} mt-3`}>{error}</p>}
    </>
  );
}
