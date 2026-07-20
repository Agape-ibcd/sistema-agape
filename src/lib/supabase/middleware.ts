import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas públicas que não exigem sessão do Supabase. `/api/cron` tem o
// próprio esquema de autenticação (header Authorization: Bearer CRON_SECRET,
// checado na própria rota) — quem chama é o Vercel Cron / pg_cron do
// Supabase, sem cookie de sessão nenhum, então precisa escapar do redirect
// para /login que este middleware aplicaria a qualquer rota privada.
// `/api/telegram/webhook` tem o próprio segredo (header
// X-Telegram-Bot-Api-Secret-Token, checado na rota) — quem chama é o
// Telegram, sem cookie de sessão. `/confirmar-presenca` é a página pública
// de RSVP (gatilho nova_escala): o link chega por e-mail/Telegram para
// quem pode nem ter conta no sistema (login não é pré-requisito), a
// segurança é o token opaco com expiração checado na própria página.
const ROTAS_PUBLICAS = [
  "/login",
  "/recuperar-senha", // recuperação por código, sem sessão (Sessão 2)
  "/auth",
  "/api/cron",
  "/api/telegram/webhook",
  "/confirmar-presenca",
  // Manifesto PWA: lido pelo navegador ANTES de qualquer login (instalação
  // como app) — conteúdo estático sem dado sensível, mesmo bug-pattern do
  // /api/cron acima: sem isso o middleware redireciona pro /login e o
  // navegador não consegue instalar o atalho na tela inicial.
  "/manifest.webmanifest",
];

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
