import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/components/providers/session-provider";

import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "MatterFlow",
  description: "Matter workflow tracker for law firms"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* 2. Toaster component */}
        <Toaster 
          position="top-center" 
          reverseOrder={false} 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
