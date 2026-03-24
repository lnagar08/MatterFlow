"use client";

import { SessionProvider } from "next-auth/react";

interface AuthProviderProps {
  children: React.ReactNode;
  refetchInterval?: number; 
}

export const AuthProvider = ({ children, refetchInterval }: AuthProviderProps) => {
  return (
    <SessionProvider refetchInterval={refetchInterval}>
      {children}
    </SessionProvider>
  );
};
