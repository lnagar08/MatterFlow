import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function hasEmailProviderConfig() {
  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    return false;
  }

  const placeholders = new Set([
    "smtp.mailtrap.io",
    "your-user",
    "your-password",
    "noreply@matterflow.app"
  ]);

  return (
    !placeholders.has(host) &&
    !placeholders.has(user) &&
    !placeholders.has(pass) &&
    !placeholders.has(from)
  );
}

// auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", 
    maxAge: 24 * 60 * 60, // 1 Day (86400 Second)
    updateAge: 6 * 60 * 60, // 6 Hours (Each 6 hours refresh session)
  },
  providers: [
    CredentialsProvider({
      name: "Email Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" } 
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email }
        });
		
        // Check 1: Ensure user exists, has a password, AND is not soft-deleted
        if (!user || !user.password || user.deletedAt) {
          // Returning null triggers the "CredentialsSignin" error on the client
          return null; 
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) return null;
	
        return user;
      }
    }),
    // ... rest of your EmailProvider logic
  ],
  callbacks: {
    async signIn({ user }) {
      if ((user as any)?.deletedAt) {
        return false; 
      }
      return true;
    },
    async jwt({ token, user }) {
      // The 'user' object here comes from the 'authorize' function return
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.parentId = (user as any).parentId;
        token.permissions = (user as any).permissions; 
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id; 
        (session.user as any).role = token.role;
        (session.user as any).parentId = token.parentId;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login" // Your root page serves as the login
  }
};