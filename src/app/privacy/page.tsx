import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/kit";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Privacy" };

const CONTACT = "syrym.abdikhan@gmail.com";
const UPDATED = "November 3, 2026";

export default function Privacy() {
  return (
    <>
      <header className="border-b border-neutral-100 dark:border-neutral-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
        <p className={ui.muted}>Last updated {UPDATED}</p>

        <p>
          SplitDown helps groups track shared expenses and settle up. This page explains what we store, who can see it, and how to
          delete it. We don&apos;t run ads, sell data or use tracking analytics.
        </p>

        <h2>What we store</h2>
        <ul>
          <li><b>Account:</b> the email address and name from your Google or GitHub account (the name is your starting display name).</li>
          <li><b>Profile:</b> your handle, display name, and a photo if you upload one.</li>
          <li><b>Group data:</b> groups, expenses (title, amount, category, date, who paid, who shared), guest names, payments and who marked them paid, and a log of these changes.</li>
          <li><b>Session cookies:</b> only to keep you signed in. Your light/dark theme choice is kept in your browser.</li>
        </ul>

        <h2>Who can see it</h2>
        <ul>
          <li>Members of a group see that group&apos;s expenses, payments and activity, plus each member&apos;s name, handle and photo.</li>
          <li>Any signed-in user can find you by handle or name to invite you to a group. Your email is never shown to other users.</li>
        </ul>

        <h2>Services we use</h2>
        <ul>
          <li><b>Supabase</b> stores the database, sign-in and photos, hosted in the EU (Ireland).</li>
          <li><b>Google</b> or <b>GitHub</b>, whichever you sign in with.</li>
          <li><b>DiceBear</b> (api.dicebear.com) draws the default pattern avatars. Your browser loads these images directly from them.</li>
          <li>A hosting provider serves this website.</li>
        </ul>

        <h2>Deleting your data</h2>
        <p>
          You can edit your profile any time in <Link href="/settings" className="text-blue-600 hover:underline">Settings</Link>, and delete your
          account there too. Deleting removes your login, email, name and photo. Expenses and payments you shared with others stay in their groups
          as &quot;Deleted user&quot;, so their balances still add up. Groups where you were the only member are deleted.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or requests about your data: <a href={`mailto:${CONTACT}`} className="text-blue-600 hover:underline">{CONTACT}</a>. If this
          policy changes, we&apos;ll update the date above.
        </p>
      </main>
    </>
  );
}
