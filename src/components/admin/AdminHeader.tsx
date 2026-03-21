"use client";
import { usePathname } from "next/navigation";
import { Bell, Search, User, ChevronDown } from "lucide-react";

export default function AdminHeader() {
  const pathname = usePathname();
  
  // Convert "/admin/usermanagement" to ["admin", "usermanagement"]
  const pathSegments = pathname.split("/").filter((item) => item !== "");

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-400 capitalize">MatterFlow</span>
        {pathSegments.map((segment, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className="text-gray-300">/</span>
            <span className={index === pathSegments.length - 1 ? "text-gray-800 font-semibold capitalize" : "text-gray-500 capitalize"}>
              {segment.replace(/-/g, " ")}
            </span>
          </div>
        ))}
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center space-x-4">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 text-sm"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-gray-200 mx-2"></div>

        {/* User Profile Dropdown */}
        <button className="flex items-center space-x-3 hover:bg-gray-50 p-1 rounded-lg transition">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            AD
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-gray-800 leading-tight">Admin User</p>
            <p className="text-[10px] text-gray-500 leading-tight">Super Admin</p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>
    </header>
  );
}