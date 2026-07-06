import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase para uso no servidor (Server Components, Server Actions, Route Handlers).
// Lê/escreve a sessão nos cookies da requisição via @supabase/ssr.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` chamado a partir de um Server Component — pode ser ignorado
            // quando há middleware renovando a sessão nas requisições.
          }
        },
      },
    },
  );
}
