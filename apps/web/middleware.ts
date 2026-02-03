import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isChromeExtension = origin.startsWith("chrome-extension://");

  // Preflight OPTIONS 요청 처리
  if (request.method === "OPTIONS" && isChromeExtension) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-KEY",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 실제 요청에 CORS 헤더 추가
  const response = NextResponse.next();
  if (isChromeExtension) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-KEY");
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
