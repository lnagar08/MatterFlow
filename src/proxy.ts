
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";


export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    
    
    if (req.nextUrl.pathname.startsWith("/home") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    }
  }
);

export const config = { 
  matcher: ["/home/:path*", "/api/protected/:path*"] 
};
