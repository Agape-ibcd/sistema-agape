-- CreateTable
CREATE TABLE "recuperacao_senha" (
    "id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "codigo_hash" VARCHAR(64) NOT NULL,
    "token_reset" VARCHAR(64),
    "expira_em" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recuperacao_senha_token_reset_key" ON "recuperacao_senha"("token_reset");

-- CreateIndex
CREATE INDEX "recuperacao_senha_membro_id_idx" ON "recuperacao_senha"("membro_id");

-- AddForeignKey
ALTER TABLE "recuperacao_senha" ADD CONSTRAINT "recuperacao_senha_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

