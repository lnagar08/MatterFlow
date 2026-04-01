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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 7.5C12 8.42826 11.6313 9.3185 10.9749 9.97487C10.3185 10.6313 9.42826 11 8.5 11C7.57174 11 6.6815 10.6313 6.02513 9.97487C5.36875 9.3185 5 8.42826 5 7.5C5 6.57174 5.36875 5.6815 6.02513 5.02513C6.6815 4.36875 7.57174 4 8.5 4C9.42826 4 10.3185 4.36875 10.9749 5.02513C11.6313 5.6815 12 6.57174 12 7.5Z" stroke="black" strokeWidth="1.5"></path>
<path d="M13.5 11C14.4283 11 15.3185 10.6313 15.9749 9.97487C16.6313 9.3185 17 8.42826 17 7.5C17 6.57174 16.6313 5.6815 15.9749 5.02513C15.3185 4.36875 14.4283 4 13.5 4" stroke="black" strokeWidth="1.5" strokeLinecap="round"></path>
<path d="M13.143 20H3.857C2.831 20 2 19.233 2 18.286C2 15.919 4.079 14 6.643 14H10.357C11.3511 13.9965 12.3228 14.2954 13.143 14.857" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
<path d="M19 14V20M22 17H16" stroke="black" strokeWidth="1.5" strokeLinecap="round"></path>
</svg>Team management
          </Link>
        )}
        
        <Link href="/rules" className="admin-dropdown__item">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.0498 6.3998V10.1998M12.0498 15.8998V23.1998M12.0498 23.1998L15.1498 19.9998M12.0498 23.1998L8.8498 19.9998M16.1498 6.3998H7.9498C6.3498 6.3998 5.1498 5.0998 5.1498 3.5998C5.1498 1.9998 6.4498 0.799805 7.9498 0.799805H16.1498C17.7498 0.799805 18.9498 2.0998 18.9498 3.5998C18.9498 5.0998 17.6498 6.3998 16.1498 6.3998ZM20.9498 15.8998H3.0498C2.7498 15.8998 2.5498 15.6998 2.5498 15.3998V10.6998C2.5498 10.3998 2.7498 10.1998 3.0498 10.1998H20.9498C21.2498 10.1998 21.4498 10.3998 21.4498 10.6998V15.3998C21.4498 15.6998 21.2498 15.8998 20.9498 15.8998Z" stroke="black" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"></path>
</svg>Flow Controls
        </Link>
        <Link href="/matters/closed" className="admin-dropdown__item">
          <svg className="close-icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="black"></path></svg>
          Closed
        </Link>
        <Link href="/matters/archived" className="admin-dropdown__item">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
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
