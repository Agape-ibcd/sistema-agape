-- CreateTable
CREATE TABLE "alteracao_perfil_pendente" (
    "id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "nome_completo" VARCHAR(200) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "celular_whatsapp" VARCHAR(20),
    "data_nascimento" DATE,
    "token" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alteracao_perfil_pendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alteracao_perfil_pendente_token_key" ON "alteracao_perfil_pendente"("token");

-- CreateIndex
CREATE INDEX "alteracao_perfil_pendente_membro_id_idx" ON "alteracao_perfil_pendente"("membro_id");

-- AddForeignKey
ALTER TABLE "alteracao_perfil_pendente" ADD CONSTRAINT "alteracao_perfil_pendente_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
