import Link from "next/link";
import { Logo } from "@/components/kit";
import { ui } from "@/lib/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo />
      <div className={`${ui.card} mt-8 w-full max-w-sm p-8`}>
        <span className="text-5xl">🧭</span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Page not found</h1>
        <p className={`mt-1 mb-6 text-sm ${ui.muted}`}>The link may be broken, or the page was moved.</p>
        <Link href="/dashboard" className={`${ui.btnPrimary} w-full`}>Back to your groups</Link>
      </div>
    </main>
  );
}
