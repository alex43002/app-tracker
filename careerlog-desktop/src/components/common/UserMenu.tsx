import { useEffect, useRef, useState } from "react";
import type { User } from "../../types/user";
import LogoutButton from "./LogoutButton";
import { fetchProfilePicture, uploadProfilePicture } from "../../api/users";

export function UserMenu(user: User) {
  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve the avatar (a GridFS id) into a displayable object URL.
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    (async () => {
      if (!user.pfp) {
        if (active) setAvatarUrl(null);
        return;
      }
      const url = await fetchProfilePicture(user.id);
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
  }, [user.id, user.pfp]);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadProfilePicture(user.id, file);
      const url = await fetchProfilePicture(user.id);
      setAvatarUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      // Surfacing upload errors is a future enhancement; keep the old avatar.
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Identity Block */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Change profile picture"
          aria-label="Change profile picture"
          className="
            relative h-9 w-9 rounded-full overflow-hidden
            bg-gray-100 flex items-center justify-center
            text-xs font-medium text-gray-600
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
            disabled:opacity-50
          "
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
            {fullName}
          </span>
        </div>
      </div>

      {/* Divider (very subtle separation) */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}
