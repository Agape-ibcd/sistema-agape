import { redirect } from "next/navigation";

// Raiz: encaminha para o painel. O middleware já redireciona ao /login quando
// não há sessão ativa.
export default function Home() {
  redirect("/dashboard");
}
