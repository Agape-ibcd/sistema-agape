"use server";

import { revalidatePath } from "next/cache";
import { requirePermissao } from "@/lib/auth";
import { aprovarCandidatura, reprovarCandidatura } from "@/lib/candidatura";
import { sucesso, falha, type EstadoAcao } from "@/lib/actions";
import type { NivelAcesso } from "@prisma/client";

export async function aprovarCandidaturaAction(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("aprovar_candidaturas");
  const candidaturaId = String(formData.get("candidaturaId") ?? "");
  const nivelAcesso = String(formData.get("nivelAcesso") ?? "") as NivelAcesso;
  const equipeId = String(formData.get("equipeId") ?? "").trim() || null;

  const NIVEIS: NivelAcesso[] = ["membro", "monitor", "lider", "admin", "super_admin"];
  if (!NIVEIS.includes(nivelAcesso)) return falha("Nível de acesso inválido.");

  const r = await aprovarCandidatura(candidaturaId, {
    nivelAcesso,
    equipeId,
    decididoPorId: usuario.membroId,
  });
  if (!r.ok) return falha(r.motivo);

  revalidatePath("/solicitacoes");
  revalidatePath("/membros");
  return sucesso(r.message);
}

export async function reprovarCandidaturaAction(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await requirePermissao("aprovar_candidaturas");
  const candidaturaId = String(formData.get("candidaturaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");

  const r = await reprovarCandidatura(candidaturaId, {
    motivo,
    decididoPorId: usuario.membroId,
  });
  if (!r.ok) return falha(r.motivo);

  revalidatePath("/solicitacoes");
  return sucesso(r.message);
}
