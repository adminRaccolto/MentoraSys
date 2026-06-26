"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderKanban, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { criarCentroCusto, editarCentroCusto, excluirCentroCusto } from "@/actions/centros-custo";

type CC = {
  id: string; nome: string; codigo: string | null; descricao: string | null;
  ativo: boolean; projeto_id: string | null;
  projeto: { id: string; titulo: string } | null;
};

interface Props { centros: CC[] }

const vazio = { nome: "", codigo: "", descricao: "", ativo: true };

export default function CentrosCustoClient({ centros: ini }: Props) {
  const [lista, setLista] = useState(ini);
  const [modal, setModal] = useState<"novo" | CC | null>(null);
  const [form, setForm] = useState(vazio);
  const [isPending, startTransition] = useTransition();

  const abrirNovo = () => { setForm(vazio); setModal("novo"); };
  const abrirEditar = (cc: CC) => {
    setForm({ nome: cc.nome, codigo: cc.codigo ?? "", descricao: cc.descricao ?? "", ativo: cc.ativo });
    setModal(cc);
  };

  const salvar = () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    startTransition(async () => {
      try {
        if (modal === "novo") {
          const { data } = await criarCentroCusto(form);
          setLista(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
          toast.success("Centro de custo criado");
        } else if (modal && typeof modal === "object") {
          const { data } = await editarCentroCusto(modal.id, form);
          setLista(prev => prev.map(c => c.id === data.id ? data : c));
          toast.success("Centro de custo atualizado");
        }
        setModal(null);
      } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    });
  };

  const excluir = (cc: CC) => {
    if (!confirm(`Excluir "${cc.nome}"?`)) return;
    startTransition(async () => {
      try {
        await excluirCentroCusto(cc.id);
        setLista(prev => prev.filter(c => c.id !== cc.id));
        toast.success("Excluído");
      } catch (e: any) { toast.error(e.message ?? "Erro ao excluir"); }
    });
  };

  const ativos   = lista.filter(c => c.ativo);
  const inativos = lista.filter(c => !c.ativo);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Centros de Custo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os CCs para controle financeiro por área ou projeto
          </p>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="size-4 mr-1.5" /> Novo CC
        </Button>
      </div>

      {lista.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Tag className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum centro de custo cadastrado</p>
          <p className="text-xs mt-1">Crie um manualmente ou marque um projeto como CC</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[{ label: "Ativos", items: ativos }, { label: "Inativos", items: inativos }].map(({ label, items }) =>
            items.length > 0 && (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                <div className="border rounded-xl divide-y">
                  {items.map(cc => (
                    <div key={cc.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/30 transition-colors">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {cc.projeto_id
                          ? <FolderKanban className="size-4 text-primary" />
                          : <Tag className="size-4 text-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{cc.nome}</span>
                          {cc.codigo && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{cc.codigo}</span>}
                          {cc.projeto_id && <Badge variant="outline" className="text-[10px] py-0">Projeto</Badge>}
                        </div>
                        {cc.descricao && <p className="text-xs text-muted-foreground truncate">{cc.descricao}</p>}
                        {cc.projeto && <p className="text-xs text-muted-foreground">→ {cc.projeto.titulo}</p>}
                      </div>
                      {!cc.projeto_id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEditar(cc)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => excluir(cc)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <Dialog open={modal !== null} onOpenChange={o => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modal === "novo" ? "Novo centro de custo" : "Editar centro de custo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Marketing, Operacional, RH…"
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Código <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input placeholder="Ex: CC001, MKT…"
                value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea placeholder="Descrição do centro de custo…" rows={2}
                value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {form.ativo
                ? <ToggleRight className="size-5 text-primary" />
                : <ToggleLeft className="size-5" />
              }
              {form.ativo ? "Ativo" : "Inativo"}
            </button>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={salvar} disabled={isPending}>Salvar</Button>
              <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
