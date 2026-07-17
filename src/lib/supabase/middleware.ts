import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas públicas que não exigem sessão do Supabase. `/api/cron` tem o
// próprio esquema de autenticação (header Authorization: Bearer CRON_SECRET,
// checado na própria rota) — quem chama é o Vercel Cron / pg_cron do
// Supabase, sem cookie de sessão nenhum, então precisa escapar do redirect
// para /login que este middleware aplicaria a qualquer rota privada.
const ROTAS_PUBLICAS = ["/login", "/auth", "/api/cron"];

// Renova a sessão do Supabase a cada requisição e protege rotas privadas.
// Segue o padrão recomendado pelo @supabase/ssr para Next.js App Router.
export async function updateSession(request: NextRequest) {
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não colocar código entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );

  // Sem sessão em rota privada → manda para o login.
  if (!user && !isPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Já autenticado tentando abrir /login → manda para o painel.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
