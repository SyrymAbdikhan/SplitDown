import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/supabase/server";
import { ui } from "@/lib/ui";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Join group" };

type Preview = { group_id: string; name: string; emoji: string; member_count: number; already_member: boolean };

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const { supabase } = await requireUserId();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const g = (data as Preview[] | null)?.[0];

  return (
    <div className={`${ui.card} mx-auto mt-12 max-w-sm p-8 text-center`}>
      {g ? (
        <>
          <span className="text-5xl">{g.emoji}</span>
          <p className={`mt-4 text-sm ${ui.muted}`}>You&apos;re invited to join</p>
          <h1 className="text-2xl font-bold tracking-tight">{g.name}</h1>
          <p className={`mt-1 mb-6 text-sm ${ui.muted}`}>{g.member_count} member{g.member_count === 1 ? "" : "s"}</p>
          {g.already_member ? (
            <Link href={`/groups/${g.group_id}`} className={`${ui.btnPrimary} w-full`}>You&apos;re already in, open group</Link>
          ) : (
            <JoinButton token={token} />
          )}
        </>
      ) : (
        <>
          <span className="text-5xl">🔗</span>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Invite link expired</h1>
          <p className={`mt-1 mb-6 text-sm ${ui.muted}`}>This link is invalid or was revoked. Ask a group admin for a new one.</p>
          <Link href="/dashboard" className={`${ui.btnOutline} w-full`}>Go to dashboard</Link>
        </>
      )}
    </div>
  );
}
