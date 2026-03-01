import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";

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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt"
  },
  providers: [
    CredentialsProvider({
      name: "Email Login",
      credentials: {
        email: { label: "Email", type: "email" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email || !email.includes("@")) {
          return null;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          return existingUser;
        }

        return prisma.user.create({
          data: {
            email,
            emailVerified: new Date()
          }
        });
      }
    }),
    ...(hasEmailProviderConfig()
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD
              }
            },
            from: process.env.EMAIL_FROM
          })
        ]
      : [])
  ],
  pages: {
    signIn: "/"
  }
};
