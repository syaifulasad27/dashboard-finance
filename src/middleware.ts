import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to protect dashboard routes
 * Checks for authentication cookie/session before allowing access
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/api/auth"];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionCookie = request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  console.log(`Middleware: ${pathname}, Session Cookie present: ${!!sessionCookie}`);
  if (!sessionCookie) {
    console.log("Cookies present:", request.cookies.getAll().map(c => c.name).join(", "));
  }

  // If no session and trying to access protected route, redirect to login
  if (!sessionCookie && pathname !== "/" && !pathname.startsWith("/api")) {
    console.log("Redirecting to login from", pathname);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/auth).*)",
  ],
};
