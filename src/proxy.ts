import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas que não precisam de autenticação Supabase
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/recuperar-senha") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/convite/") ||
    pathname.startsWith("/membro/") ||
    pathname.startsWith("/diagnostico/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/diagnostico-lead/") ||
    pathname === "/api/diagnostico-lead" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/produtos/") ||
    pathname.startsWith("/api/campanhas/") ||
    pathname.startsWith("/api/crm/") ||
    pathname === "/api/contratos" ||
    pathname.startsWith("/api/contratos/");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/recuperar-senha")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
