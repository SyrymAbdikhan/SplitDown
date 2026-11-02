"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Logo } from "@/components/kit";
import { ui } from "@/lib/ui";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  // Server errors arrive with a digest that matches the server log; message details are hidden in production.
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo />
      <div className={`${ui.card} mt-8 w-full max-w-sm p-8`}>
        <span className="text-5xl">😵</span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className={`mt-1 text-sm ${ui.muted}`}>This is usually temporary. Try again, or head back to your groups.</p>
        <div className="mt-6 flex flex-col gap-2">
          <button className={ui.btnPrimary} onClick={retry}>
            <RotateCw size={16} /> Try again
          </button>
          <Link href="/dashboard" className={ui.btnOutline}>Back to your groups</Link>
        </div>
        {digest && <p className="mt-4 font-mono text-[11px] text-neutral-400">Ref: {digest}</p>}
      </div>
    </main>
  );
}
