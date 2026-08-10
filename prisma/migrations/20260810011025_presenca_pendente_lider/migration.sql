-- AlterEnum
ALTER TYPE "GatilhoNotificacao" ADD VALUE 'presenca_pendente';

-- AlterTable
ALTER TABLE "escala_equipe_evento" ADD COLUMN     "avisos_presenca_pendente" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimo_aviso_presenca_pendente_em" TIMESTAMP(3);
