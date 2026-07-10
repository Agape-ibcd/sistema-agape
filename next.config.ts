import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O client do Prisma é gerado fora de node_modules (output customizado em
  // src/generated/prisma). O rastreamento de arquivos do Next não pega os
  // binários do motor (.so.node) automaticamente nesse caso — sem isso, a
  // função serverless da Vercel não embarca o engine e o Prisma quebra em
  // runtime (PrismaClientInitializationError: could not locate Query Engine).
  outputFileTracingIncludes: {
    "*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
