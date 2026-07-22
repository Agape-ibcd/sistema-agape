-- DropIndex
DROP INDEX "eventos_tipo_evento_id_data_evento_key";

-- CreateTable
CREATE TABLE "escala_membro" (
    "id" UUID NOT NULL,
    "escala_id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "criado_por" UUID,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_membro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escala_membro_membro_id_idx" ON "escala_membro"("membro_id");

-- CreateIndex
CREATE UNIQUE INDEX "escala_membro_escala_id_membro_id_key" ON "escala_membro"("escala_id", "membro_id");

-- CreateIndex
CREATE INDEX "eventos_tipo_evento_id_data_evento_idx" ON "eventos"("tipo_evento_id", "data_evento");

-- AddForeignKey
ALTER TABLE "escala_membro" ADD CONSTRAINT "escala_membro_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escala_equipe_evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_membro" ADD CONSTRAINT "escala_membro_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
