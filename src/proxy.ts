import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const { pathname } = req.nextUrl;

  // 1. PUBLIC PATHS CHECK
  const isPublicPath = pathname === "/" || pathname === "/auth-admin";
  
  if ((pathname === "/" || pathname === "/auth-admin") && token) {
    const url = token.role === "ADMIN" ? "/admin/usermanagement" : "/home";
    return NextResponse.redirect(new URL(url, req.url));
  }

  if (!token && pathname !== "/" && pathname !== "/auth-admin") {
    const loginUrl = pathname.startsWith("/admin") ? "/auth-admin" : "/";
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  // 3. ROLE-BASED PROTECTION
  const isAdmin = token?.role === "ADMIN";
  const isStaff = token?.role === "STAFF";

  // Staff Block for /users
  if (isStaff && pathname.startsWith("/users")) {
    return NextResponse.redirect(new URL("/access-denied", req.url));
  }

  // Admin protection for /admin paths
  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/auth-admin", req.url));
  }

  return NextResponse.next();
}

// MATCHER: यहाँ ध्यान दें कि किन पेजों पर मिडलवेयर चलना चाहिए
export const config = {
  matcher: [
    "/",
    "/home/:path*",
    "/admin/:path*",
    "/users/:path*",
    "/access-denied",
  ],
};
