"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errMsg, ui } from "@/lib/ui";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callback = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function oauth(provider: "google" | "github") {
    setBusy(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
    if (error) {
      setError(errMsg(error));
      setBusy(null);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setBusy(null);
    if (error) setError(errMsg(error));
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify");
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setError(errMsg(error));
      setBusy(null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sent)
    return (
      <form onSubmit={verify} className="space-y-4">
        <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          We sent a code and a sign-in link to <b>{email}</b>. Enter the code, or click the link in the email.
        </div>
        <input
          className={`${ui.input} h-11 text-center font-mono text-lg tracking-[0.4em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          required
        />
        {error && <p className={ui.error}>{error}</p>}
        <button className={`${ui.btnPrimary} h-10 w-full`} disabled={busy !== null || code.length < 6}>
          {busy === "verify" && <Loader2 size={16} className="animate-spin" />} Verify and continue
        </button>
        <button type="button" onClick={() => (setSent(false), setCode(""), setError(null))} className={`${ui.btnGhost} w-full`}>
          <ArrowLeft size={16} /> Use a different email
        </button>
      </form>
    );

  return (
    <div className="space-y-3">
      <button onClick={() => oauth("google")} disabled={busy !== null} className={`${ui.btnOutline} h-10 w-full`}>
        {busy === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />} Continue with Google
      </button>
      <button onClick={() => oauth("github")} disabled={busy !== null} className={`${ui.btnOutline} h-10 w-full`}>
        {busy === "github" ? <Loader2 size={16} className="animate-spin" /> : <GitHubIcon />} Continue with GitHub
      </button>
      <div className="flex items-center gap-3 py-2 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" /> or <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <form onSubmit={sendCode} className="space-y-3">
        <input className={`${ui.input} h-10`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className={`${ui.btnDark} h-10 w-full`} disabled={busy !== null}>
          {busy === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Continue with email
        </button>
      </form>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
