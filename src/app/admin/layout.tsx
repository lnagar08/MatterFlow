// app/(admin)/layout.tsx
import { StrictMode } from 'react';
import { Toaster } from "react-hot-toast";
//import SidebarItem from "./SidebarItem";
import "../../app/admin.css";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/admin/Sidebar'
import AppHeader from "./header";
import AppFooter from '@/components/layout/app-footer';
import { ThemeProvider } from "@/context/ThemeContext";

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
	<StrictMode>
		<ThemeProvider defaultTheme="light" storageKey="app-theme">
      		<SidebarProvider defaultOpen={true}>
				<AppSidebar />
				<SidebarInset>
					<AppHeader />
					<div className="flex-1 space-y-4 p-4 px-5">
						<Toaster position="top-center" />
						{children}
					</div>
					<AppFooter />
				</SidebarInset>
			</SidebarProvider>
    </ThemeProvider>
	</StrictMode>
    
    
    
  );
}