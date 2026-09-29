import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { CV_BY_DESIGN_HOSTS } from "@/lib/brand"

const CV_BY_DESIGN_TRANSITION_PATH = "/cv-by-design-transition"

function isCvByDesignHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? ""
  return CV_BY_DESIGN_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  )
}

/**
 * Edge routing:
 * - cv-by-design.com `/` → transition landing (rewrite, not redirect)
 * - equitai.eu.com `/` → existing mission homepage (unchanged)
 * - `/app/*` → pass through (auth checked client-side on load)
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? ""
  const { pathname } = request.nextUrl

  if (isCvByDesignHost(host) && (pathname === "/" || pathname === "/index.html")) {
    return NextResponse.rewrite(new URL(CV_BY_DESIGN_TRANSITION_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/index.html", "/app/:path*"],
}
