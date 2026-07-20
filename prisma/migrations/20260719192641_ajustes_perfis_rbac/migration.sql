-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GatilhoNotificacao" ADD VALUE 'membro_editado_por_lider';
ALTER TYPE "GatilhoNotificacao" ADD VALUE 'perfil_editado';

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT false;
