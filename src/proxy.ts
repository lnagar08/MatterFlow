import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16+ requires the function name to be exactly 'proxy' or 'default'
export async function proxy(req: NextRequest) {
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const { pathname } = req.nextUrl;

  const isAdmin = token?.role === "ADMIN";
  const isStaff = token?.role === "STAFF";
  // 1. PUBLIC PATHS & ROLE-BASED REDIRECTS (Already Logged In)
  const isPublicPath = pathname === "/login" || pathname === "/auth-admin";
  
  if (isPublicPath) {
    if (token) {
      const url = isAdmin ? "/admin/usermanagement" : "/home";
      return NextResponse.redirect(new URL(url, req.url));
    }
    return NextResponse.next();
  }

  // 2. AUTH CHECK: If not logged in, redirect to login
  if (!token) {
    const loginUrl = pathname.startsWith("/admin") ? "/auth-admin" : "/login";
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  // 3. STAFF HARD BLOCK: /users
  if (isStaff && (pathname === "/users" || pathname.startsWith("/users/"))) {
    return NextResponse.redirect(new URL("/access-denied", req.url));
  }

  // 4. ADMIN PROTECTION
  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/auth-admin", req.url));
  }

  return NextResponse.next();
}

// 6. MATCHER CONFIG
export const config = {
  matcher: [
    "/login",
    "/home/:path*",
    "/admin/:path*",
    "/matters/:path*",
    "/templates/:path*",
    "/users",
    "/users/:path*",
    "/access-denied",
    "/penalty-box",
    "/rules"
  ],
};
