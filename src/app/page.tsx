import Link from "next/link";
import { ArrowRight, ChevronRight, History, Link2, Lock, Radio, Scale, Shield } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/kit";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui";

const FEATURES = [
  { icon: Scale, title: "Fewest payments", text: "We net everything out so the group settles with the smallest number of transfers. No chains of IOUs." },
  { icon: Lock, title: "Locked periods", text: "Hit Split and that period is final. New expenses start a fresh tab, so history never shifts under you." },
  { icon: Link2, title: "Invite your way", text: "Find friends by @handle or share an invite link. Admins control who's in." },
  { icon: Shield, title: "Roles that make sense", text: "Everyone edits their own expenses. Owners and admins can fix anything that's still open." },
  { icon: Radio, title: "Live for everyone", text: "When someone adds dinner, it shows up on everyone's screen instantly." },
  { icon: History, title: "Full activity log", text: "Every add, edit, delete and payment is recorded, so there's no need to argue about who changed what." },
];

const PREVIEW = [
  { e: "🏠", t: "Cabin, 2 nights", by: "Ann", amt: "$480.00" },
  { e: "🛒", t: "Groceries", by: "Ben", amt: "$96.40" },
  { e: "🚕", t: "Airport taxi", by: "Cat", amt: "$54.00" },
  { e: "🍔", t: "Dinner at Lou's", by: "Ann", amt: "$131.60" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/80 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Logo />
          <nav className="hidden gap-1 text-sm font-medium sm:flex">
            <a href="#features" className="rounded-md px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">Features</a>
            <a href="#how" className="rounded-md px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">How it works</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link href="/dashboard" className={ui.btnPrimary}>Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className={`${ui.btnGhost} max-sm:hidden`}>Log in</Link>
                <Link href="/login" className={ui.btnPrimary}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:pt-28">
          <span className="inline-flex rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
            Free · No ads · Built for groups
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Split bills,
            <br />
            not <span className="text-gradient">friendships</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
            Log shared expenses as they happen. When you&apos;re ready, hit <b className="font-semibold text-neutral-900 dark:text-white">Split</b> and get the fewest payments that settle everyone up.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link href={signedIn ? "/dashboard" : "/login"} className={`${ui.btnPrimary} h-11 px-6 text-base`}>
              {signedIn ? "Go to dashboard" : "Start splitting free"}
            </Link>
            <a href="#how" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
              See how it works <ChevronRight size={15} />
            </a>
          </div>
        </section>

        {/* Product preview */}
        <section className="mx-auto max-w-5xl px-4 pb-24">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2 shadow-xl shadow-neutral-200/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
            <div className="grid gap-2 md:grid-cols-[1fr_300px]">
              <div className={`${ui.card} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><span className="text-xl">🏔️</span> Ski trip</div>
                  <span className={ui.chip}>USD · 3 members</span>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {PREVIEW.map((r) => (
                    <div key={r.t} className="flex items-center gap-3 py-3 text-sm">
                      <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-base dark:bg-neutral-800">{r.e}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{r.t}</div>
                        <div className={`text-xs ${ui.muted}`}>Paid by {r.by} · split 3 ways</div>
                      </div>
                      <div className="font-semibold tabular-nums">{r.amt}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${ui.card} flex flex-col p-5 text-left`}>
                <div className={`text-xs font-medium tracking-wide uppercase ${ui.muted}`}>Settle up</div>
                <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">$762.00</div>
                <div className={`mb-4 text-sm ${ui.muted}`}>4 expenses since last split</div>
                {[["Ben", "Ann", "$157.60"], ["Cat", "Ann", "$200.00"]].map(([f, t, a]) => (
                  <div key={f} className="mb-2 flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800">
                    <b>{f}</b> <ArrowRight size={14} className="text-neutral-400" /> <b>{t}</b>
                    <span className="ml-auto font-semibold tabular-nums">{a}</span>
                  </div>
                ))}
                <div className={`${ui.btnPrimary} mt-auto w-full`}>Split the bill</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-neutral-950 px-4 py-24 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-violet-300">Every</span> expense. <span className="text-violet-300">Every</span> friend. Zero awkward math.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-400">Trips, flatshares, team lunches, weddings. If more than one person is paying, SplitDown keeps it fair.</p>
          <div className="mx-auto mt-12 grid max-w-3xl gap-8 sm:grid-cols-3">
            {[["1 tap", "to split the whole tab"], ["n − 1", "max payments for n people"], ["0", "rounding errors, ever"]].map(([a, b]) => (
              <div key={a}>
                <div className="text-4xl font-bold tracking-tight">{a}</div>
                <div className="mt-1 text-sm text-neutral-400">{b}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24">
          <h2 className="text-center text-4xl font-bold tracking-tight">Everything a group needs</h2>
          <p className={`mt-3 text-center ${ui.muted}`}>Nothing it doesn&apos;t.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className={`${ui.card} p-6`}>
                <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${ui.muted}`}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-16 border-t border-neutral-100 bg-neutral-50 px-4 py-24 dark:border-neutral-900 dark:bg-neutral-900/40">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-4xl font-bold tracking-tight">How it works</h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                ["Create a group", "Name it, pick a currency, invite friends by handle or link."],
                ["Log expenses", "Who paid, how much, and who it's for. Everyone's included by default."],
                ["Hit Split", "Get the fewest payments to settle up. Mark them paid as money moves."],
              ].map(([t, d], i) => (
                <div key={t}>
                  <div className="grid size-9 place-items-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{i + 1}</div>
                  <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                  <p className={`mt-1 text-sm leading-relaxed ${ui.muted}`}>{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-16 text-center">
              <Link href={signedIn ? "/dashboard" : "/login"} className={`${ui.btnPrimary} h-11 px-6 text-base`}>
                {signedIn ? "Go to dashboard" : "Create your first group"} <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-100 dark:border-neutral-900">
        <div className={`mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm ${ui.muted}`}>
          <Logo />
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-white">Privacy</Link>
            <span>© {new Date().getFullYear()} SplitDown</span>
          </span>
        </div>
      </footer>
    </>
  );
}
