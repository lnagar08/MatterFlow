import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Next.js Middleware with Role-Based Access Control (RBAC).
 * Specifically manages access for 'ATTORNEY' and 'ADMIN' roles.
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // --- Role Definitions ---
    const isAttorney = token?.role === "ATTORNEY";
    const isAdmin = token?.role === "ADMIN";

    // --- 1. Attorney Route Protection ---
    // Protected paths: /home, /penalty-box, /rules, /templates
    const attorneyPaths = ["/home", "/penalty-box", "/rules", "/templates"];
    const isAttorneyRoute = attorneyPaths.some((path) => pathname.startsWith(path));

    if (isAttorneyRoute && !isAttorney && !isAdmin) {
      // If the user is neither an Attorney nor an Admin, redirect to landing page
      return NextResponse.redirect(new URL("/", req.url));
    }

    // --- 2. Admin Route Protection ---
    // Protected paths: /admin, /dashboard
    const adminPaths = ["/admin"];
    const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));

    if (isAdminRoute && !isAdmin) {
      // Only Admins can access these pages; redirect others
      return NextResponse.redirect(new URL("/", req.url));
    }

    // --- 3. Protected API Routes ---
    if (pathname.startsWith("/api/protected") && !isAttorney && !isAdmin) {
      return new NextResponse(
        JSON.stringify({ error: "Access Denied" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      /**
       * Ensures the middleware only executes for authenticated users.
       * The 'authorized' callback checks for a valid JWT token.
       */
      authorized: ({ token }) => !!token,
    },
  }
);

/**
 * Configure the paths where this middleware should run.
 * Includes all attorney and admin specific routes.
 */
export const config = { 
  matcher: [
    "/home/:path*", 
    "/penalty-box/:path*", 
    "/rules/:path*", 
    "/templates/:path*", 
    "/admin/:path*", 
    //"/dashboard/:path*",
    "/api/protected/:path*"
  ] 
};
