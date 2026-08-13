-- CreateEnum
CREATE TYPE "OrigemConvite" AS ENUM ('link', 'email');

-- CreateEnum
CREATE TYPE "StatusCandidatura" AS ENUM ('pendente', 'aprovado', 'reprovado');

-- AlterEnum
ALTER TYPE "GatilhoNotificacao" ADD VALUE 'nova_candidatura';

-- CreateTable
CREATE TABLE "convite_ministerio" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "origem" "OrigemConvite" NOT NULL,
    "email_convidado" VARCHAR(150),
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convite_ministerio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatura_membro" (
    "id" UUID NOT NULL,
    "convite_id" UUID NOT NULL,
    "nome_completo" VARCHAR(200) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "celular_whatsapp" VARCHAR(20) NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "foto_url" VARCHAR(500) NOT NULL,
    "membro_desde" DATE NOT NULL,
    "fez_curso_mnv" BOOLEAN NOT NULL,
    "mnv_conclusao" DATE,
    "aluno_escola_biblica" BOOLEAN NOT NULL,
    "participa_outro_ministerio" BOOLEAN NOT NULL,
    "quais_ministerios" VARCHAR(300),
    "status" "StatusCandidatura" NOT NULL DEFAULT 'pendente',
    "decidido_por_id" UUID,
    "decidido_em" TIMESTAMP(3),
    "motivo_reprovacao" TEXT,
    "equipe_id_definida" UUID,
    "nivel_acesso_definido" "NivelAcesso",
    "membro_criado_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidatura_membro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convite_ministerio_token_key" ON "convite_ministerio"("token");

-- CreateIndex
CREATE INDEX "convite_ministerio_criado_por_id_idx" ON "convite_ministerio"("criado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidatura_membro_membro_criado_id_key" ON "candidatura_membro"("membro_criado_id");

-- CreateIndex
CREATE INDEX "candidatura_membro_convite_id_idx" ON "candidatura_membro"("convite_id");

-- CreateIndex
CREATE INDEX "candidatura_membro_status_idx" ON "candidatura_membro"("status");

-- AddForeignKey
ALTER TABLE "convite_ministerio" ADD CONSTRAINT "convite_ministerio_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatura_membro" ADD CONSTRAINT "candidatura_membro_convite_id_fkey" FOREIGN KEY ("convite_id") REFERENCES "convite_ministerio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
