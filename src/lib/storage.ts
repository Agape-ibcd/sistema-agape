import "server-only";
import { createClient } from "@supabase/supabase-js";

// Acesso ao Supabase Storage com a service role (só no servidor).
// Bucket `fotos-membros` é público para leitura; escrita passa por aqui,
// sempre atrás das permissões RBAC das Server Actions.

const BUCKET = "fotos-membros";
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB (a foto já chega 300×300 do cliente)

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuração do Supabase Storage ausente (URL/SERVICE_ROLE_KEY).");
  }
  return createClient(url, serviceKey).storage.from(BUCKET);
}

// Sobe (ou substitui) a foto do membro e retorna a URL pública com
// cache-buster — o caminho é sempre o mesmo ({id}.jpg), então o ?v= força
// o navegador a buscar a versão nova após a troca.
export async function uploadFotoMembro(
  membroId: string,
  foto: File,
): Promise<string> {
  if (!["image/jpeg", "image/png"].includes(foto.type)) {
    throw new Error("A foto deve ser JPG ou PNG.");
  }
  if (foto.size > TAMANHO_MAXIMO) {
    throw new Error("A foto deve ter no máximo 2 MB.");
  }

  const storage = storageAdmin();
  const caminho = `${membroId}.jpg`;
  const bytes = new Uint8Array(await foto.arrayBuffer());

  const { error } = await storage.upload(caminho, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`Falha no upload da foto: ${error.message}`);

  const { data } = storage.getPublicUrl(caminho);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removerFotoMembro(membroId: string): Promise<void> {
  const { error } = await storageAdmin().remove([`${membroId}.jpg`]);
  if (error) throw new Error(`Falha ao remover a foto: ${error.message}`);
}
