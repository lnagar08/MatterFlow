"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react"

type Props = {
  userName?: string | null;
};

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function AdminDropdown({ userName }: Props) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [resolvedName, setResolvedName] = useState<string>(() => userName?.trim() || "Admin");

  useEffect(() => {
    if (userName?.trim()) {
      setResolvedName(userName.trim());
    }
  }, [userName]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      const target = event.target as Node | null;
      if (target && details.contains(target)) return;
      details.open = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const details = detailsRef.current;
      if (!details || !details.open) return;
      details.open = false;
      const summary = details.querySelector("summary") as HTMLElement | null;
      summary?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (userName?.trim()) return;
    let active = true;

    async function loadSessionUser() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;
        const session = (await response.json()) as { user?: { name?: string | null; email?: string | null } } | null;
        if (!active) return;
        const sessionName = session?.user?.name?.trim() || session?.user?.email?.split("@")[0]?.trim();
        if (sessionName) {
          setResolvedName(sessionName);
        }
      } catch {
        // TODO: Replace fallback when auth context is standardized globally.
      }
    }

    void loadSessionUser();
    return () => {
      active = false;
    };
  }, [userName]);

  const displayName = useMemo(() => resolvedName || "Admin", [resolvedName]);
  const initials = useMemo(() => initialsFromName(displayName), [displayName]);

  return (
    <details ref={detailsRef} className="admin-dropdown avatar-menu relative z-[80]">
      <summary className="admin-dropdown__trigger avatar-trigger list-none cursor-pointer">
        <span className="admin-pill-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="admin-pill-name">{displayName}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="admin-dropdown__panel avatar-panel absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 z-50">
        <Link href="/settings/users" className="admin-dropdown__item">
          Users
        </Link>
        <Link href="/rules" className="admin-dropdown__item">
          Flow Controls
        </Link>
        <Link href="/matters/closed" className="admin-dropdown__item">
          Closed
        </Link>
        <Link href="/matters/archived" className="admin-dropdown__item">
          Archived
        </Link>
		<button 
  onClick={() => signOut({ callbackUrl: "/" })}
  className="text-blue-500 hover:underline bg-transparent border-none p-0 cursor-pointer"
>
  Logout
</button>
      </div>
    </details>
  );
}
