"use server";

import { requireUsuario } from "@/lib/auth";
import { gerarConvite } from "@/lib/candidatura";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";

export type EstadoConvite = (NonNullable<EstadoAcao> & { url?: string }) | null;

// Gera o link compartilhável — reaproveitável até expirar (90 dias).
export async function gerarLinkConvite(): Promise<EstadoConvite> {
  const usuario = await requireUsuario();
  const r = await gerarConvite(usuario.membroId, "link");
  if (!r.ok) return falha(r.motivo);
  return { ...sucesso("Link de convite gerado.")!, url: r.url };
}

// Gera o convite e envia por e-mail ao endereço informado.
export async function convidarPorEmail(
  _prev: EstadoConvite,
  formData: FormData,
): Promise<EstadoConvite> {
  const usuario = await requireUsuario();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return falha("Informe o e-mail do convidado.");

  const r = await gerarConvite(usuario.membroId, "email", email);
  if (!r.ok) return falha(r.motivo);
  return { ...sucesso(`Convite enviado para ${email}.`)!, url: r.url };
}
