-- AlterEnum
ALTER TYPE "StatusMembro" ADD VALUE 'afastado';

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "motivo_status" VARCHAR(300),
ADD COLUMN     "retorno_previsto" DATE;
