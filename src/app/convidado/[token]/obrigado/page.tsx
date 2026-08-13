import Link from "next/link";
import { AgapeLogo } from "@/components/AgapeLogo";
import { Rodape } from "@/components/Rodape";

// Página PÚBLICA de agradecimento, após o envio da candidatura — mesmo texto
// do e-mail de agradecimento (src/lib/candidatura.ts), adaptado para página
// (sem saudação nominal nem assinatura, que fazem sentido só no e-mail).
export default function ObrigadoPage() {
  return (
    <div className="agape-dots flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="vidro w-full max-w-md rounded-2xl p-6 text-center">
          <div className="mb-6 flex flex-col items-center">
            <AgapeLogo markSize={56} />
          </div>

          <h1 className="text-lg font-semibold text-ink">Obrigado por querer participar!</h1>

          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Recebemos com muita alegria o seu formulário de interesse em servir no Ministério
            Ágape. Louvamos a Deus pela sua disposição em dedicar seu tempo e talentos para
            acolher as pessoas na Casa de Deus.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            O Líder do Ministério já recebeu os seus dados e, em breve, entrará em contato com
            você para conversarem — a resposta chega em até <strong>7 dias</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Antes disso, conheça as nossas Orientações e Regras Práticas — é a base do nosso
            serviço:
          </p>

          <Link
            href="/nosso-servir"
            className="menu-item-destaque mt-4 inline-block rounded-xl px-6 py-3 text-sm font-semibold"
          >
            <span className="menu-item-destaque-texto">O MINISTÉRIO ÁGAPE DA CASA DE DEUS</span>
          </Link>

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Que Deus abençoe grandemente a sua vida!
          </p>
        </div>
      </div>
      <Rodape />
    </div>
  );
}
