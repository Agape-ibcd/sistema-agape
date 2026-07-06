import Link from "next/link";
import { requireUsuario } from "@/lib/auth";
import { can, ROTULO_NIVEL } from "@/lib/rbac";

export default async function DashboardPage() {
  const usuario = await requireUsuario();

  const atalhos = [
    {
      href: "/presenca",
      titulo: "Registrar Presença",
      desc: "Lance presença e pontualidade da sua equipe.",
      permissao: "registrar_presenca_propria" as const,
      etapa: 4,
    },
    {
      href: "/eventos",
      titulo: "Eventos e Escalas",
      desc: "Cultos, recorrências e escala das equipes.",
      permissao: "gerenciar_escalas" as const,
      etapa: 3,
    },
    {
      href: "/membros",
      titulo: "Membros",
      desc: "Cadastro, fotos e vínculo com equipes.",
      permissao: "gerenciar_membros" as const,
      etapa: 3,
    },
    {
      href: "/aniversariantes",
      titulo: "Aniversariantes",
      desc: "Aniversários do mês e alertas.",
      permissao: "painel_aniversariantes" as const,
      etapa: 5,
    },
  ].filter((a) => can(usuario.nivelAcesso, a.permissao));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          Olá, {usuario.nomeCompleto.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Você está conectado como{" "}
          <span className="font-medium text-emerald-700">
            {ROTULO_NIVEL[usuario.nivelAcesso]}
          </span>
          {usuario.equipeNome ? ` · ${usuario.equipeNome}` : ""}.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Fundação concluída (Etapa 1).</strong> Login, níveis de acesso,
        auditoria e layout base estão no ar. As telas abaixo serão construídas
        nas próximas etapas do plano.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {atalhos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900">{a.titulo}</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                Etapa {a.etapa}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
