// components/admin/SidebarItem.tsx
"use client"; // CRITICAL: This must be a Client Component to use hooks

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  
  // This logic handles both exact matches and sub-routes
  // e.g., if you are at /admin/dashboard/edit, the "/admin/dashboard" link stays active
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link 
      href={href}
      className={`block p-3 rounded-lg transition-colors ${
        isActive 
          ? "bg-blue-600 text-white font-bold" // Active styles
          : "text-gray-400 hover:bg-slate-800 hover:text-white" // Inactive styles
      }`}
    >
      {label}
    </Link>
  );
}