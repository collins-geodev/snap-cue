"use client";

import { UserAvatar, useUser } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageBytes = 5 * 1024 * 1024;

export function ProfilePhoto() {
  const { user } = useUser();
  const [saving, setSaving] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    const form = event.currentTarget;
    const photo = new FormData(form).get("photo");
    if (!(photo instanceof File) || !photo.size || !imageTypes.includes(photo.type) || photo.size > maxImageBytes) {
      toast.error("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }

    setSaving(true);
    try {
      await user.setProfileImage({ file: photo });
      form.reset();
      toast.success("Profile photo updated.");
    } catch {
      toast.error("Could not update your profile photo. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack spaced" aria-labelledby="profile-photo-heading">
      <div className="card-title">
        <div>
          <h2 id="profile-photo-heading">Profile photo</h2>
          <p>Your photo appears on your SnapCue account.</p>
        </div>
        <UserAvatar appearance={{ elements: { avatarBox: "size-12" } }} />
      </div>
      <form className="stack" onSubmit={upload}>
        <label>
          Choose a photo
          <input type="file" name="photo" accept={imageTypes.join(",")} aria-describedby="profile-photo-help" required disabled={saving || !user} />
        </label>
        <p id="profile-photo-help" className="muted">JPEG, PNG, or WebP · up to 5 MB</p>
        <div><Button type="submit" disabled={saving || !user}>{saving ? "Uploading…" : "Upload photo"}</Button></div>
      </form>
    </section>
  );
}
