import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/components/providers/session-provider";

import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "FlowGuardian",
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
        <Toaster position="top-center" />
        <AuthProvider refetchInterval={3600}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}