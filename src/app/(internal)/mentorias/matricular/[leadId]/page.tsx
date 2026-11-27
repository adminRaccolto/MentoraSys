import { notFound } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { matricularLeadGanho } from "@/actions/mentoria-crm";
import { CabecalhoModulo } from "@/components/cabecalho-modulo";
import { Formulario } from "@/components/mentorias/formulario";
import { caixa, campo, rotulo, VoltarMentorias } from "@/components/mentorias/painel";
import { verificarPermissao } from "@/lib/permissoes";
import { empresaMentorias } from "@/lib/mentorias";
import { prisma } from "@/lib/prisma";

export default async function MatricularLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const [{ leadId }, empresaId, acessoCrm, criaIndividual] = await Promise.all([
    params,
    empresaMentorias().catch(() => null),
    verificarPermissao("crm", "editar").then(() => true, () => false),
    empresaMentorias("criar").then(() => true, () => false),
  ]);
  if (!empresaId || !acessoCrm) notFound();
  const [lead, turmas] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId, empresa_id: empresaId, etapa_chave: "GANHO" },
      select: { nome: true, contato_nome: true, email: true, cliente: { select: { nome: true, email: true, empresa_id: true } } },
    }),
    prisma.mentoria.findMany({ where: { empresa_id: empresaId, tipo: "GRUPO" }, select: { id: true, nome: true, turma: true }, orderBy: [{ nome: "asc" }, { turma: "asc" }] }),
  ]);
  if (!lead || (lead.cliente && lead.cliente.empresa_id !== empresaId)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7">
      <VoltarMentorias href="/crm">Voltar ao CRM</VoltarMentorias>
      <CabecalhoModulo titulo="Matricular mentorado" icone={<UserRoundPlus />} />
      <section className={caixa}>
        <p className="text-sm text-muted-foreground">Oportunidade ganha · {lead.nome}</p>
        {!turmas.length && !criaIndividual ? <p className="text-sm">Nenhuma turma disponível.</p> : (
          <Formulario acao={matricularLeadGanho.bind(null, leadId)} botao="Matricular aluno" variant="default" textoLink="Abrir alunos da mentoria">
            <label className={rotulo}>Nome do mentorado
              <input name="nome" className={campo} defaultValue={lead.cliente?.nome ?? lead.contato_nome ?? lead.nome} required maxLength={140} />
            </label>
            <label className={rotulo}>E-mail para acesso
              <input name="email" type="email" className={campo} defaultValue={lead.cliente?.email ?? lead.email ?? ""} maxLength={254} />
            </label>
            <label className={rotulo}>Mentoria
              <select name="destino" required defaultValue="" className={campo}>
                <option value="" disabled>Selecione a mentoria</option>
                {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}{turma.turma ? ` · ${turma.turma}` : ""}</option>)}
                {criaIndividual && <option value="nova-individual">Mentoria individual</option>}
              </select>
            </label>
          </Formulario>
        )}
      </section>
    </div>
  );
}
