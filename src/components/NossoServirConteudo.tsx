// Conteúdo institucional "Nosso Servir" — orientações e regras práticas do
// Ministério Ágape (texto fornecido pelo usuário em 2026-08-13, mesmo
// conteúdo do antigo PDF de regras). Reaproveitado em duas rotas:
//   • pública `/nosso-servir` (link do botão no e-mail de agradecimento da
//     candidatura, acessível sem login)
//   • item de menu "Nosso Servir" (mesma URL, visível a qualquer usuário logado)
export function NossoServirConteudo() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-ink-soft">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-text">
          O Nosso Servir
        </p>
        <p className="mt-2 text-ink">
          O Ministério Ágape é o ministério acolhedor da Casa de Deus.
        </p>
        <p className="mt-3 font-medium italic text-ink">
          Nossa missão: <span className="text-brand-text">Receber a todos com muito amor.</span>
        </p>
      </div>

      <p>
        É curar feridas através do cuidado mútuo e ser o &ldquo;cartão postal&rdquo; da nossa
        igreja. Como nos ensina{" "}
        <em>
          Romanos 15:7: &ldquo;Portanto, aceitem-se uns aos outros, da mesma forma como Cristo
          os aceitou, a fim de que vocês glorifiquem a Deus&rdquo;.
        </em>
      </p>

      <p>
        Este é um trabalho voluntário para Deus e, exatamente por isso, procuramos fazer o
        nosso melhor, com excelência e dedicação. Para que você compreenda bem o nosso
        funcionamento antes de preencher os seus dados, leia atentamente as nossas
        orientações abaixo:
      </p>

      <Secao titulo="1. Escala e Atuação">
        <Item titulo="Frequência">
          Você fará parte de uma equipe focada no culto de domingo (pela manhã ou à noite). A
          escala ocorre a cada 2 semanas (quinzenalmente) no seu respectivo turno.
        </Item>
        <Item titulo="Apoio durante a semana">
          Na semana da sua escala, as equipes da manhã e da noite apoiam juntas os cultos e
          eventos que ocorrerem durante a semana.
        </Item>
        <Item titulo="Culto de Batismo">
          Acontece a cada dois ou três meses, no domingo à noite. Neste dia, todas as equipes
          Ágape são escaladas. Como é um evento com várias atividades diferenciadas e bem
          movimentado, orientamos usar uma roupa e calçado mais leves (a cor, no entanto,
          permanece preta).
        </Item>
        <Item titulo="Eventos Especiais">
          Em campanhas e conferências, criamos escalas diferenciadas que vocês ficarão
          sabendo previamente.
        </Item>
      </Secao>

      <Secao titulo="2. Horário e Preparação">
        <Item titulo="Pontualidade">
          Chegamos sempre <strong>1 hora e 15 minutos antes</strong> do início do culto.
        </Item>
        <Item titulo="Por que chegamos cedo?">
          Porque nos reunimos em uma sala para orar e fazer o alinhamento do dia. Além disso,
          este é o momento em que iniciamos a preparação da mesa de café. Esse tempo
          preparatório é fundamental para servirmos com o coração abastecido.
        </Item>
      </Secao>

      <Secao titulo="3. Nosso Trabalho Prático">
        <p className="mb-2">
          Ao nos posicionarmos próximos às entradas do Hall, nossas principais atribuições
          são:
        </p>
        <Item titulo="Receber">
          Cumprimentar nossos irmãos e visitantes com um sorriso, um abraço, uma palavra de
          &ldquo;bem-vindo&rdquo;.
        </Item>
        <Item titulo="Auxiliar">Ajudar na locomoção de pessoas com alguma dificuldade física.</Item>
        <Item titulo="Orientar">
          Explicar a localização das principais dependências da Igreja, como banheiros,
          bebedouros, espaço kids, lanchonete, etc.
        </Item>
      </Secao>

      <Secao titulo="4. O Que Devemos Evitar">
        <p className="mb-2">
          Para mantermos a excelência e a atenção ao Reino, orientamos expressamente evitar:
        </p>
        <Item titulo="Rodinhas de conversa">
          Não forme grupos de bate-papo com outros voluntários. O &ldquo;falatório&rdquo;
          desvia a atenção das portas e pode inibir a aproximação de pessoas novas.
        </Item>
        <Item titulo="Uso do celular">
          Tenha cuidado para não se distrair com o aparelho. O momento do plantão exige
          postura ativa e olhar atento a quem está chegando.
        </Item>
        <Item titulo="Isolamento">
          Não fique em lugares escondidos, isolados ou fora do seu posto. Mantenha-se visível
          e acessível.
        </Item>
        <Item titulo="Decisões isoladas">
          Não tome decisões sozinho diante de situações atípicas (como pessoas pedindo ajuda
          financeira, pedintes ou imprevistos). Busque sempre o apoio do seu Líder.
        </Item>
        <Item titulo="Indiscrição e intimidade excessiva">
          Evite fazer perguntas indiscretas ou forçar uma intimidade (como usar apelidos).
          Mantenha sempre o respeito.
        </Item>
        <Item titulo="Apatia">
          Nosso serviço não deve ser mecânico. Jamais demonstre postura de indisposição
          física ou distanciamento.
        </Item>
      </Secao>

      <Secao titulo="5. Vestimenta e Postura">
        <Item titulo="Traje">Roupa social preta.</Item>
        <Item titulo="Postura">
          O objetivo é causar uma excelente impressão desde o primeiro contato, garantindo
          que as pessoas se sintam felizes e seguras por terem vindo. Sua proatividade é
          fundamental.
        </Item>
      </Secao>

      <Secao titulo="6. Acompanhamento e Liderança">
        <p>
          O Líder do Ministério irá falar com você e apresentará o seu Líder de Equipe, que
          estará ao seu lado para ajudar com todos os procedimentos e orientações práticas.
        </p>
        <p className="mt-2">
          Você será adicionado(a) ao grupo de WhatsApp da sua equipe e ao grupo geral do
          ministério para o envio de informações e para mantermos nossa comunhão.
        </p>
      </Secao>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink">{titulo}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <p>
      <strong className="text-ink">{titulo}:</strong> {children}
    </p>
  );
}
