-- CreateEnum
CREATE TYPE "GatilhoNotificacao" AS ENUM ('aniversario_dia', 'nova_escala', 'escala_alterada', 'lembrete_vespera');

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('email', 'telegram');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('enviado', 'falhou', 'pulado');

-- CreateTable
CREATE TABLE "config_notificacao" (
    "id" UUID NOT NULL,
    "gatilho" "GatilhoNotificacao" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "niveis_alvo" "NivelAcesso"[],
    "canais" "CanalNotificacao"[],
    "assunto" VARCHAR(200),
    "mensagem" TEXT,
    "horario_envio" VARCHAR(5),
    "atualizado_por" UUID,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_notificacao" (
    "id" UUID NOT NULL,
    "gatilho" "GatilhoNotificacao" NOT NULL,
    "membro_id" UUID NOT NULL,
    "canal" "CanalNotificacao" NOT NULL,
    "status" "StatusEnvio" NOT NULL,
    "destino" VARCHAR(200) NOT NULL,
    "detalhe" TEXT,
    "referencia_id" VARCHAR(100),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_notificacao_gatilho_key" ON "config_notificacao"("gatilho");

-- CreateIndex
CREATE INDEX "log_notificacao_membro_id_idx" ON "log_notificacao"("membro_id");

-- CreateIndex
CREATE INDEX "log_notificacao_gatilho_criado_em_idx" ON "log_notificacao"("gatilho", "criado_em");

-- AddForeignKey
ALTER TABLE "log_notificacao" ADD CONSTRAINT "log_notificacao_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
