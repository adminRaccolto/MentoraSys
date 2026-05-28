import { obterConviteEmpresa } from "@/actions/equipe";
import MembroConviteClient from "./membro-convite-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function MembroConvitePage({ params }: Props) {
  const { token } = await params;
  const res = await obterConviteEmpresa(token);

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center space-y-3">
          <div className="size-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <svg className="size-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Convite inválido</h1>
          <p className="text-sm text-slate-500">{res.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <MembroConviteClient token={token} convite={res.convite} />
    </div>
  );
}
