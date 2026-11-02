import type { Metadata } from "next";
import { requireUserId } from "@/lib/supabase/server";
import { ui } from "@/lib/ui";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, userId } = await requireUserId();
  const [{ data: profile }, { data: user }] = await Promise.all([
    supabase.from("profiles").select("id, handle, display_name, avatar_url").eq("id", userId).single(),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <section className={`${ui.card} p-6`}>
        <h2 className="font-semibold">Profile</h2>
        <p className={`mb-5 text-sm ${ui.muted}`}>People find and invite you by your handle.</p>
        {profile && <ProfileForm profile={profile} />}
      </section>
      <section className={`${ui.card} flex items-center justify-between gap-4 p-6`}>
        <div className="min-w-0">
          <h2 className="font-semibold">Account</h2>
          <p className={`truncate text-sm ${ui.muted}`}>Signed in as {user.user?.email ?? user.user?.phone}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className={ui.btnOutline}>Sign out</button>
        </form>
      </section>
    </div>
  );
}
