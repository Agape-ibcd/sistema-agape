import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Middleware global: renova a sessão do Supabase e barra rotas privadas sem login.
// A autorização fina por nível de acesso (RBAC) é feita nos layouts/páginas/actions.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto estáticos e imagens.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
