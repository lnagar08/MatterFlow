"use client";
import { useSession } from "next-auth/react";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  
  if (parts.length === 0) return "AD"; // Fallback for Admin
  
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  
  return parts[0].slice(0, 2).toUpperCase();
}

export function AdminDropdown() {
  const { data: session, status } = useSession();
  const user = session?.user as { 
    name?: string | null; 
    email?: string | null; 
    role?: string; 
    parentId?: string; 
  } | undefined;

  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || "Admin";
  const shortName = initialsFromName(userName);
  
  if (status === "loading") return <div>Loading...</div>;
  if (!user) return null;

  return (
    <details className="admin-dropdown avatar-menu relative z-[80]">
      <summary className="admin-dropdown__trigger avatar-trigger list-none cursor-pointer">
        <span className="admin-pill-avatar" aria-hidden="true">
          {shortName}
        </span>
        <span className="admin-pill-name">{userName}</span>
        
      </summary>
      <div className="admin-dropdown__panel avatar-panel absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 z-50">
        {user.role === 'ATTORNEY' && (
          <Link href="/users" className="admin-dropdown__item">
            Team management
          </Link>
        )}
        
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
      onClick={async () => {
        await signOut({ redirect: true, callbackUrl: "/login" });
      }}
      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 active:scale-[0.97]"
    >
      {/* Logout Icon matching the Login/Register icons style */}
      <LogOut className="h-4 w-4" />
      
      {/* Button Text */}
      <span>Logout</span>
    </button>
      </div>
    </details>
  );
}
