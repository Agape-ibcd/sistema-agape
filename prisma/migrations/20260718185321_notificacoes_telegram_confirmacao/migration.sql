-- CreateEnum
CREATE TYPE "StatusConfirmacaoEscala" AS ENUM ('pendente', 'confirmado', 'recusado');

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "telegram_link_expira" TIMESTAMP(3),
ADD COLUMN     "telegram_link_token" VARCHAR(64);

-- CreateTable
CREATE TABLE "confirmacao_escala" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "escala_id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "status" "StatusConfirmacaoEscala" NOT NULL DEFAULT 'pendente',
    "expira_em" TIMESTAMP(3) NOT NULL,
    "respondido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmacao_escala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "confirmacao_escala_token_key" ON "confirmacao_escala"("token");

-- CreateIndex
CREATE INDEX "confirmacao_escala_escala_id_idx" ON "confirmacao_escala"("escala_id");

-- CreateIndex
CREATE INDEX "confirmacao_escala_membro_id_idx" ON "confirmacao_escala"("membro_id");

-- CreateIndex
CREATE UNIQUE INDEX "membros_telegram_link_token_key" ON "membros"("telegram_link_token");

-- AddForeignKey
ALTER TABLE "confirmacao_escala" ADD CONSTRAINT "confirmacao_escala_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escala_equipe_evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmacao_escala" ADD CONSTRAINT "confirmacao_escala_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

