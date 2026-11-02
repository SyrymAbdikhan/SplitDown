import Link from "next/link";
import { Avatar, Logo, ThemeToggle } from "@/components/kit";
import { requireUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, userId } = await requireUserId();
  const { data: profile } = await supabase.from("profiles").select("id, handle, display_name, avatar_url").eq("id", userId).single();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Logo href="/dashboard" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/settings" className="ml-1 flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <Avatar profile={profile ?? undefined} size={28} />
              <span className="hidden font-medium sm:inline">@{profile?.handle}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
