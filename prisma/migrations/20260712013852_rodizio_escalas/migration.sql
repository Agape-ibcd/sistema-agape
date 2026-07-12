-- CreateEnum
CREATE TYPE "OrigemEscala" AS ENUM ('manual', 'rodizio');

-- AlterTable
ALTER TABLE "escala_equipe_evento" ADD COLUMN     "origem" "OrigemEscala" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "rodizio_escala" (
    "id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "semana_ancora" DATE NOT NULL,
    "ciclo" JSONB NOT NULL,
    "criado_por" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rodizio_escala_pkey" PRIMARY KEY ("id")
);
