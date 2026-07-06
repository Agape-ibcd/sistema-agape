import Link from "next/link";

export default function NaoAutorizado() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-20 text-center">
      <p className="text-5xl font-bold text-emerald-700">403</p>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900">
        Acesso não autorizado
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-600">
        Seu nível de acesso não permite abrir esta área. Se acredita que isso é
        um engano, fale com um administrador do Ministério Ágape.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
