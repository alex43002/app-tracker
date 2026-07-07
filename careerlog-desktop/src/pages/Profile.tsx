import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { useCurrentUser } from "../store/userContext";
import { ApiError } from "../api/client";
import {
  deleteProfilePicture,
  fetchProfilePicture,
  updateUser,
  uploadProfilePicture,
  type UpdateUserPayload,
} from "../api/users";

/* ============================================================
   Profile settings (FEAT-28)

   View and edit core account details (name, email, phone) plus
   the profile picture, with validation and persistence to the
   backend. Changing the email resets verification server-side.
============================================================ */

interface FormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Profile() {
  const { user, refreshUser } = useCurrentUser();

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed the form from the loaded user.
  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      email: user.email,
    });
  }, [user]);

  // Resolve the avatar (a GridFS id) to a displayable object URL.
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    (async () => {
      if (!user?.pfp) {
        if (active) setAvatarUrl(null);
        return;
      }
      const url = await fetchProfilePicture(user.id, user.pfp);
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setAvatarUrl(url);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.pfp]);

  if (!user) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-gray-500">Loading profile…</div>
      </AppLayout>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Only the fields that actually changed.
  const changed: UpdateUserPayload = {};
  if (form.firstName.trim() !== user.firstName)
    changed.firstName = form.firstName.trim();
  if (form.lastName.trim() !== user.lastName)
    changed.lastName = form.lastName.trim();
  if (form.phoneNumber.trim() !== user.phoneNumber)
    changed.phoneNumber = form.phoneNumber.trim();
  if (form.email.trim().toLowerCase() !== user.email.toLowerCase())
    changed.email = form.email.trim();
  const isDirty = Object.keys(changed).length > 0;

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.phoneNumber.trim()) next.phoneNumber = "Phone number is required";
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isDirty || !validate()) return;

    setSaving(true);
    try {
      const res = await updateUser(user.id, changed);
      await refreshUser();
      if (changed.email && !res.emailVerified) {
        toast.success("Profile saved. Verify your new email address.");
      } else {
        toast.success("Profile saved");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarBusy(true);
    try {
      await uploadProfilePicture(user.id, file);
      await refreshUser();
      toast.success("Profile picture updated");
    } catch {
      toast.error("Failed to upload picture");
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    if (!user?.pfp) return;
    setAvatarBusy(true);
    try {
      await deleteProfilePicture(user.id);
      await refreshUser();
      toast.success("Profile picture removed");
    } catch {
      toast.error("Failed to remove picture");
    } finally {
      setAvatarBusy(false);
    }
  }

  function field(key: keyof FormState, label: string, type = "text") {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">{label}</span>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors[key] && (
          <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>
        )}
      </label>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile settings</h1>
          <p className="text-sm text-gray-500">
            View and update your account details.
          </p>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-lg font-medium text-gray-600">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {avatarBusy ? "Working…" : "Change picture"}
            </button>
            {user.pfp && (
              <button
                type="button"
                disabled={avatarBusy}
                onClick={handleAvatarRemove}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Details form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field("firstName", "First name")}
            {field("lastName", "Last name")}
          </div>
          {field("phoneNumber", "Phone number", "tel")}
          <div>
            {field("email", "Email", "email")}
            <p className="mt-1 flex items-center gap-2 text-xs">
              {user.emailVerified ? (
                <span className="text-green-600">✓ Verified</span>
              ) : (
                <span className="text-amber-600">
                  ⚠ Not verified — check your inbox
                </span>
              )}
              <span className="text-gray-400">
                Changing your email requires re-verification.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!isDirty || saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {isDirty && !saving && (
              <span className="text-xs text-gray-400">Unsaved changes</span>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
