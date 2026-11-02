import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/kit";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-neutral-50 px-4 py-16 dark:bg-neutral-950">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">Sign in or create an account. It takes a few seconds.</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">That sign-in link didn&apos;t work. Please try again.</p>}
        <LoginForm next={safeNext(typeof next === "string" ? next : null)} />
      </div>
      <p className="mt-6 max-w-xs text-center text-xs text-neutral-500">
        By continuing you agree to split things fairly. See how we handle your data in our{" "}
        <Link href="/privacy" className="underline hover:text-neutral-900 dark:hover:text-white">privacy policy</Link>.
      </p>
    </main>
  );
}
