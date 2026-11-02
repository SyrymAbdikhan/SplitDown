"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Dices, ImageUp, Loader2 } from "lucide-react";
import { Avatar, generatedAvatar } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { errMsg, ui } from "@/lib/ui";

/** Center-crops and shrinks a photo to a small square so uploads stay tiny. */
async function squareImage(file: File, size = 256): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/webp", 0.9),
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [avatarBusy, setAvatarBusy] = useState<"random" | "upload" | null>(null);

  // Avatar changes save right away so the header updates too.
  async function saveAvatar(url: string) {
    const { error } = await createClient().from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    if (error) throw error;
    setAvatar(url);
    router.refresh();
  }

  async function changeAvatar(kind: "random" | "upload", file?: File) {
    setAvatarBusy(kind);
    setError(null);
    try {
      if (kind === "random") {
        await saveAvatar(generatedAvatar(Math.random().toString(36).slice(2))); // just a seed; crypto.randomUUID needs HTTPS
      } else if (file) {
        const sb = createClient();
        const path = `${profile.id}/avatar`;
        const blob = await squareImage(file);
        const { error } = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: blob.type });
        if (error) throw error;
        await saveAvatar(`${sb.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`);
      }
    } catch (e) {
      setError(errMsg(e));
    }
    setAvatarBusy(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return setError("Handle must be 3–20 characters: a–z, 0–9 or _");
    setState("saving");
    const { error } = await createClient()
      .from("profiles")
      .update({ display_name: name.trim(), handle })
      .eq("id", profile.id);
    if (error) {
      setState("idle");
      return setError(error.code === "23505" ? "That handle is taken" : errMsg(error));
    }
    setState("saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar profile={{ ...profile, display_name: name, avatar_url: avatar }} size={64} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ui.btnOutline} disabled={avatarBusy !== null} onClick={() => changeAvatar("random")}>
            {avatarBusy === "random" ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />} Randomize
          </button>
          <label className={`${ui.btnOutline} ${avatarBusy ? "pointer-events-none opacity-50" : ""}`}>
            {avatarBusy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />} Upload photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) changeAvatar("upload", f);
              }}
            />
          </label>
        </div>
      </div>
      <div>
        <label className={ui.label} htmlFor="name">Display name</label>
        <input id="name" className={ui.input} value={name} onChange={(e) => (setName(e.target.value), setState("idle"))} maxLength={50} required />
      </div>
      <div>
        <label className={ui.label} htmlFor="handle">Handle</label>
        <div className="relative">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-400">@</span>
          <input
            id="handle"
            className={`${ui.input} pl-7`}
            value={handle}
            onChange={(e) => (setHandle(e.target.value.toLowerCase()), setState("idle"))}
            maxLength={20}
            required
          />
        </div>
      </div>
      {error && <p className={ui.error}>{error}</p>}
      <button className={ui.btnPrimary} disabled={state === "saving"}>
        {state === "saving" && <Loader2 size={16} className="animate-spin" />}
        {state === "saved" ? <><Check size={16} /> Saved</> : "Save changes"}
      </button>
    </form>
  );
}
