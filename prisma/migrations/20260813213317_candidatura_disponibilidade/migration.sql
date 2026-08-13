/*
  Warnings:

  - Added the required column `culto_domingo_manha` to the `candidatura_membro` table without a default value. This is not possible if the table is not empty.
  - Added the required column `culto_domingo_noite` to the `candidatura_membro` table without a default value. This is not possible if the table is not empty.
  - Added the required column `disponibilidade_semana` to the `candidatura_membro` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DisponibilidadeSemana" AS ENUM ('regular', 'ocasional');

-- AlterTable
ALTER TABLE "candidatura_membro" ADD COLUMN     "culto_domingo_manha" BOOLEAN NOT NULL,
ADD COLUMN     "culto_domingo_noite" BOOLEAN NOT NULL,
ADD COLUMN     "disponibilidade_semana" "DisponibilidadeSemana" NOT NULL;
