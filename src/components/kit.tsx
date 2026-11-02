"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Moon, Sun, X } from "lucide-react";
import type { Profile } from "@/lib/types";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-neutral-900 text-sm text-white dark:bg-white dark:text-neutral-900">
        ½
      </span>
      splitdown
    </Link>
  );
}

/** Symmetric pixel-square identicon from DiceBear; the same seed always gives the same image. */
export const generatedAvatar = (seed: string) => `https://api.dicebear.com/9.x/identicon/svg?scale=65&seed=${encodeURIComponent(seed)}`;

export function Avatar({ profile, size = 28 }: { profile?: Pick<Profile, "id" | "display_name" | "avatar_url">; size?: number }) {
  const style = { width: size, height: size };
  const ring = "shrink-0 rounded-full ring-2 ring-white dark:ring-neutral-900";
  if (!profile) return <span style={style} className={`${ring} bg-neutral-200 dark:bg-neutral-700`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url ?? generatedAvatar(profile.id)} alt={profile.display_name} title={profile.display_name} style={style} className={`${ring} bg-neutral-100 object-cover dark:bg-neutral-800`} />
  );
}

/** Native <dialog> modal: focus trap, Esc to close and backdrop come from the browser. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ThemeToggle() {
  const flip = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.theme = dark ? "dark" : "light";
    } catch {}
  };
  // Crossfades the whole page where the browser supports view transitions; instant elsewhere.
  const toggle = () => (document.startViewTransition ? document.startViewTransition(flip) : flip());
  return (
    <button onClick={toggle} aria-label="Toggle theme" className="inline-flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">
      <Moon size={17} className="dark:hidden" />
      <Sun size={17} className="hidden dark:block" />
    </button>
  );
}

const GROUP_EMOJIS = ["👥", "🏔️", "🏖️", "🏠", "🍕", "✈️", "🎉", "💼", "⚽", "🎮", "🚗", "❤️"];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GROUP_EMOJIS.map((e) => (
        <button
          type="button"
          key={e}
          onClick={() => onChange(e)}
          aria-label={`Icon ${e}`}
          aria-pressed={value === e}
          className={`grid size-10 place-items-center rounded-lg border text-xl transition ${value === e ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
