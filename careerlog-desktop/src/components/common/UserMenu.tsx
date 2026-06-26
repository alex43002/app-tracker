import { useEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";
import { useCurrentUser } from "../../store/userContext";
import { fetchProfilePicture, uploadProfilePicture } from "../../api/users";

/**
 * Header identity control. Clicking the avatar opens a user settings menu
 * (BUG-15); "Change profile picture" is one item inside it rather than the
 * whole click. The current user comes from the shared store so a new picture
 * propagates everywhere after upload (BUG-14).
 */
export function UserMenu() {
  const { user, refreshUser } = useCurrentUser();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fullName = user ? `${user.firstName} ${user.lastName}` : "";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Resolve the avatar (a GridFS id) into a displayable object URL. Keyed on
  // `pfp` so a refreshed user (post-upload) re-fetches; `pfp` also cache-busts.
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

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      await uploadProfilePicture(user.id, file);
      // Pull the new pfp id into the shared store; the avatar effect re-fetches
      // (cache-busted) so every surface updates, not just this menu.
      await refreshUser();
    } catch {
      // Surfacing upload errors is a future enhancement; keep the old avatar.
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Open user menu"
        className="
          flex items-center gap-3 rounded-full
          focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
        "
      >
        <span
          className="
            relative h-9 w-9 rounded-full overflow-hidden
            bg-gray-100 flex items-center justify-center
            text-xs font-medium text-gray-600
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
        </span>

        <span className="hidden text-sm font-medium text-gray-900 sm:block truncate max-w-[160px]">
          {fullName}
        </span>

        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${
            menuOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {menuOpen && (
        <div
          role="menu"
          className="
            absolute right-0 z-50 mt-2 w-60 overflow-hidden
            rounded-lg border border-gray-200 bg-white shadow-lg
          "
        >
          {/* Identity header */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-gray-900">
              {fullName}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>

          {/* Settings */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="
                flex w-full items-center gap-2 px-4 py-2 text-left text-sm
                text-gray-700 hover:bg-gray-50 disabled:opacity-50
              "
            >
              <svg
                className="h-4 w-4 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              {uploading ? "Uploading…" : "Change profile picture"}
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-100 p-2">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
