// app/(admin)/layout.tsx
import { StrictMode } from 'react';
import { Toaster } from "react-hot-toast";
//import SidebarItem from "./SidebarItem";
import "../../app/admin.css";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from '@/context/ThemeContext';


export default function LoginLayout({
  children
}: {
  children: React.ReactNode;
}) {
   
  return (
        <>
        <Toaster position="top-center" />
        <ThemeProvider defaultTheme="dark" storageKey="app-theme">
          {children}
        </ThemeProvider>
        </>        
  );
}