-- CreateEnum
CREATE TYPE "NivelAcesso" AS ENUM ('super_admin', 'admin', 'lider', 'membro');

-- CreateEnum
CREATE TYPE "StatusMembro" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "TurnoEquipe" AS ENUM ('manha', 'noite', 'variavel');

-- CreateEnum
CREATE TYPE "StatusEquipe" AS ENUM ('ativa', 'inativa');

-- CreateEnum
CREATE TYPE "TipoRecorrencia" AS ENUM ('diario', 'semanal', 'quinzenal', 'mensal_dia_fixo', 'mensal_posicao', 'mensal_ultima_posicao', 'avulso');

-- CreateEnum
CREATE TYPE "CategoriaEvento" AS ENUM ('culto_regular', 'evento_extra', 'campanha', 'conferencia', 'batismo', 'outro');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('agendado', 'realizado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoEscala" AS ENUM ('regular', 'especial', 'cobertura');

-- CreateEnum
CREATE TYPE "Pontualidade" AS ENUM ('pontual', 'atrasado');

-- CreateTable
CREATE TABLE "membros" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID,
    "data_cadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR(150) NOT NULL,
    "equipe_id" UUID,
    "nome_completo" VARCHAR(200) NOT NULL,
    "celular_whatsapp" VARCHAR(20),
    "data_nascimento" DATE,
    "observacao" TEXT,
    "foto_url" VARCHAR(500),
    "status" "StatusMembro" NOT NULL DEFAULT 'ativo',
    "nivel_acesso" "NivelAcesso" NOT NULL DEFAULT 'membro',
    "notif_email" BOOLEAN NOT NULL DEFAULT true,
    "notif_telegram" BOOLEAN NOT NULL DEFAULT false,
    "notif_push" BOOLEAN NOT NULL DEFAULT false,
    "telegram_chat_id" VARCHAR(50),
    "ultimo_acesso" TIMESTAMP(3),

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "turno_padrao" "TurnoEquipe" NOT NULL DEFAULT 'variavel',
    "cor_hex" VARCHAR(7),
    "status" "StatusEquipe" NOT NULL DEFAULT 'ativa',
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe_lideres" (
    "id" UUID NOT NULL,
    "equipe_id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "data_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" DATE,

    CONSTRAINT "equipe_lideres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_evento" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "horario_inicio" VARCHAR(5) NOT NULL,
    "horario_chegada_equipe" VARCHAR(5) NOT NULL,
    "tipo_recorrencia" "TipoRecorrencia" NOT NULL,
    "config_recorrencia" JSONB NOT NULL DEFAULT '{}',
    "categoria" "CategoriaEvento" NOT NULL DEFAULT 'culto_regular',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL,
    "tipo_evento_id" UUID NOT NULL,
    "data_evento" DATE NOT NULL,
    "horario_inicio" VARCHAR(5) NOT NULL,
    "horario_chegada_equipe" VARCHAR(5) NOT NULL,
    "descricao_especifica" VARCHAR(200),
    "status" "StatusEvento" NOT NULL DEFAULT 'agendado',
    "gerado_automaticamente" BOOLEAN NOT NULL DEFAULT false,
    "criado_por" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala_equipe_evento" (
    "id" UUID NOT NULL,
    "evento_id" UUID NOT NULL,
    "equipe_id" UUID NOT NULL,
    "tipo_escala" "TipoEscala" NOT NULL DEFAULT 'regular',
    "observacao" TEXT,
    "criado_por" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_equipe_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presenca" (
    "id" UUID NOT NULL,
    "data_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evento_id" UUID NOT NULL,
    "equipe_id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "pontualidade" "Pontualidade",
    "horario_chegada" VARCHAR(5),
    "justificativa_ausencia" TEXT,
    "registrado_por" UUID NOT NULL,
    "editado_em" TIMESTAMP(3),
    "editado_por" UUID,
    "excluido_em" TIMESTAMP(3),
    "excluido_por" UUID,
    "motivo_exclusao" TEXT,
    "restaurado_em" TIMESTAMP(3),
    "restaurado_por" UUID,

    CONSTRAINT "presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "acao" VARCHAR(50) NOT NULL,
    "tabela_afetada" VARCHAR(100) NOT NULL,
    "registro_id" VARCHAR(100),
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "ip" VARCHAR(50),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membros_auth_user_id_key" ON "membros"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");

-- CreateIndex
CREATE INDEX "membros_equipe_id_idx" ON "membros"("equipe_id");

-- CreateIndex
CREATE INDEX "membros_status_idx" ON "membros"("status");

-- CreateIndex
CREATE INDEX "membros_nivel_acesso_idx" ON "membros"("nivel_acesso");

-- CreateIndex
CREATE INDEX "equipe_lideres_equipe_id_idx" ON "equipe_lideres"("equipe_id");

-- CreateIndex
CREATE INDEX "equipe_lideres_membro_id_idx" ON "equipe_lideres"("membro_id");

-- CreateIndex
CREATE INDEX "tipos_evento_ativo_idx" ON "tipos_evento"("ativo");

-- CreateIndex
CREATE INDEX "eventos_data_evento_idx" ON "eventos"("data_evento");

-- CreateIndex
CREATE INDEX "eventos_status_idx" ON "eventos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_tipo_evento_id_data_evento_key" ON "eventos"("tipo_evento_id", "data_evento");

-- CreateIndex
CREATE INDEX "escala_equipe_evento_equipe_id_idx" ON "escala_equipe_evento"("equipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "escala_equipe_evento_evento_id_equipe_id_key" ON "escala_equipe_evento"("evento_id", "equipe_id");

-- CreateIndex
CREATE INDEX "presenca_evento_id_equipe_id_membro_id_idx" ON "presenca"("evento_id", "equipe_id", "membro_id");

-- CreateIndex
CREATE INDEX "presenca_membro_id_idx" ON "presenca"("membro_id");

-- CreateIndex
CREATE INDEX "audit_log_tabela_afetada_registro_id_idx" ON "audit_log"("tabela_afetada", "registro_id");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_lideres" ADD CONSTRAINT "equipe_lideres_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_lideres" ADD CONSTRAINT "equipe_lideres_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tipo_evento_id_fkey" FOREIGN KEY ("tipo_evento_id") REFERENCES "tipos_evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_equipe_evento" ADD CONSTRAINT "escala_equipe_evento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_equipe_evento" ADD CONSTRAINT "escala_equipe_evento_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca" ADD CONSTRAINT "presenca_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca" ADD CONSTRAINT "presenca_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca" ADD CONSTRAINT "presenca_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraint anti-duplicata PARCIAL: um membro só pode ter UM lançamento ativo
-- (não excluído) por evento+equipe. Registros excluídos logicamente não contam,
-- permitindo re-lançamento após exclusão. (Prisma não declara índices parciais no schema.)
CREATE UNIQUE INDEX "presenca_evento_equipe_membro_ativo_key"
  ON "presenca" ("evento_id", "equipe_id", "membro_id")
  WHERE "excluido_em" IS NULL;
