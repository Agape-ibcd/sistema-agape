"use server";

import { redirect } from "next/navigation";
import { buscarConvitePorToken, criarCandidatura } from "@/lib/candidatura";
import { parseDataISO } from "@/lib/recorrencia";
import { falha, type EstadoAcao } from "@/lib/actions";

// "YYYY-MM" (input type=month) → primeiro dia do mês, em UTC.
function parseMesAno(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return new Date(Date.UTC(ano, mes - 1, 1));
}

// Página PÚBLICA (sem login) — a segurança é o token opaco do convite, com
// expiração checada tanto aqui quanto em criarCandidatura.
export async function enviarCandidatura(
  _prev: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const token = String(formData.get("token") ?? "");
  const resultado = await buscarConvitePorToken(token);
  if (!resultado.valido) return falha(resultado.motivo);

  const nascimentoStr = String(formData.get("dataNascimento") ?? "").trim();
  const dataNascimento = parseDataISO(nascimentoStr);
  if (!dataNascimento) return falha("Data de nascimento inválida.");

  const membroDesdeStr = String(formData.get("membroDesde") ?? "").trim();
  const membroDesde = parseMesAno(membroDesdeStr);
  if (!membroDesde) return falha("Informe desde quando você é membro da Igreja (mês/ano).");

  const fezCursoMnv = formData.get("fezCursoMnv") === "on";
  let mnvConclusao: Date | null = null;
  if (fezCursoMnv) {
    const mnvStr = String(formData.get("mnvConclusao") ?? "").trim();
    mnvConclusao = parseMesAno(mnvStr);
    if (!mnvConclusao) return falha("Informe o mês/ano de conclusão do curso MNV.");
  }

  const alunoEscolaBiblica = formData.get("alunoEscolaBiblica") === "on";
  const participaOutroMinisterio = formData.get("participaOutroMinisterio") === "on";
  const quaisMinisterios = String(formData.get("quaisMinisterios") ?? "").trim() || null;
  if (participaOutroMinisterio && !quaisMinisterios) {
    return falha("Informe quais outros ministérios você participa.");
  }

  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) {
    return falha("A foto é obrigatória.");
  }

  const r = await criarCandidatura(
    resultado.convite.id,
    {
      nomeCompleto: String(formData.get("nomeCompleto") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      celularWhatsapp: String(formData.get("celularWhatsapp") ?? "").trim(),
      dataNascimento,
      membroDesde,
      fezCursoMnv,
      mnvConclusao,
      alunoEscolaBiblica,
      participaOutroMinisterio,
      quaisMinisterios,
    },
    foto,
  );

  if (!r.ok) return falha(r.motivo);

  redirect(`/convidado/${token}/obrigado`);
}
