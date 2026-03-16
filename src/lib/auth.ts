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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt"
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
		if (!credentials?.email || !credentials?.password) return null;
        if (!email || !email.includes("@")) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email }
        });
		
		if (!user || !user.password) return null;

		const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

		if (!isPasswordValid) return null;
	
        //if (existingUser) {
          return user;
        //}

        /*return prisma.user.create({
          data: {
            email,
            emailVerified: new Date()
          }
        });*/
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
  callbacks: {
    async jwt({ token, user }) {
      
      if (user) {
	    token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      
      if (session.user) {
	      (session.user as any).id = token.id; 
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: "/"
  }
};
