"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Printer, ChevronRight, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarConteudo } from "@/actions/diagnosticos";

interface NoOrgano {
  id: string;
  nome: string;
  cargo: string;
  departamento?: string;
  parentId: string | null;
}

interface OrganoConteudo { nos: NoOrgano[] }

interface Props {
  id: string; titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const uuid = () => Math.random().toString(36).slice(2, 10);

function buildTree(nos: NoOrgano[], parentId: string | null): NoOrgano[] {
  return nos.filter(n => n.parentId === parentId);
}

function NodeCard({ no, nos, onUpdate, onDelete, onAddChild }: {
  no: NoOrgano; nos: NoOrgano[];
  onUpdate: (id: string, field: keyof NoOrgano, value: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = buildTree(nos, no.id);

  return (
    <div className="flex flex-col items-center gap-0">
      {/* Conector vertical de cima */}
      {no.parentId && <div className="w-px h-5 bg-border" />}
      <div className="rounded-lg border bg-card shadow-sm w-52">
        <div className="p-3 space-y-1.5">
          <Input
            value={no.nome}
            onChange={e => onUpdate(no.id, "nome", e.target.value)}
            placeholder="Nome"
            className="h-7 text-sm font-medium"
          />
          <Input
            value={no.cargo}
            onChange={e => onUpdate(no.id, "cargo", e.target.value)}
            placeholder="Cargo / Função"
            className="h-7 text-xs"
          />
          <Input
            value={no.departamento ?? ""}
            onChange={e => onUpdate(no.id, "departamento", e.target.value)}
            placeholder="Departamento (opcional)"
            className="h-7 text-xs"
          />
          <div className="flex gap-1 pt-0.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAddChild(no.id)} title="Adicionar subordinado">
              <Plus className="size-3" />
            </Button>
            {children.length > 0 && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive ml-auto" onClick={() => onDelete(no.id)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filhos */}
      {expanded && children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-5 bg-border" />
          <div className="flex gap-8 items-start relative">
            {/* Linha horizontal conectora */}
            {children.length > 1 && (
              <div
                className="absolute top-0 border-t border-border"
                style={{ left: "50%", transform: "translateX(-50%)", width: `${(children.length - 1) * 240}px` }}
              />
            )}
            {children.map(child => (
              <NodeCard key={child.id} no={child} nos={nos} onUpdate={onUpdate} onDelete={onDelete} onAddChild={onAddChild} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorOrganograma({ id, titulo, conteudo, cliente }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [nos, setNos] = useState<NoOrgano[]>(() => {
    const c = conteudo as Partial<OrganoConteudo>;
    return c.nos ?? [{ id: uuid(), nome: "", cargo: "CEO / Diretor", departamento: "", parentId: null }];
  });

  const raizes = buildTree(nos, null);

  const updateNo = useCallback((nodeId: string, field: keyof NoOrgano, value: string) => {
    setNos(prev => prev.map(n => n.id === nodeId ? { ...n, [field]: value } : n));
  }, []);

  const addChild = useCallback((parentId: string) => {
    setNos(prev => [...prev, { id: uuid(), nome: "", cargo: "", departamento: "", parentId }]);
  }, []);

  const addRoot = () => {
    setNos(prev => [...prev, { id: uuid(), nome: "", cargo: "", departamento: "", parentId: null }]);
  };

  const deleteNo = useCallback((nodeId: string) => {
    // Remove o nó e todos os descendentes
    const descendants = new Set<string>();
    const collect = (id: string) => {
      descendants.add(id);
      nos.filter(n => n.parentId === id).forEach(n => collect(n.id));
    };
    collect(nodeId);
    setNos(prev => prev.filter(n => !descendants.has(n.id)));
  }, [nos]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await salvarConteudo(id, { nos });
      router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/diagnosticos")}>
            <ArrowLeft className="size-4" />
          </Button>
          <Users className="size-5 text-primary" />
          <div>
            <h1 className="font-semibold text-sm">{titulo}</h1>
            {cliente && <p className="text-xs text-muted-foreground">{cliente.nome}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden print:hidden">
            <Printer className="size-3.5 mr-1.5" /> Exportar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="p-8 overflow-auto">
        <div className="flex flex-col items-center gap-8 min-w-max mx-auto">
          {raizes.map(no => (
            <NodeCard key={no.id} no={no} nos={nos} onUpdate={updateNo} onDelete={deleteNo} onAddChild={addChild} />
          ))}
          <Button variant="outline" size="sm" onClick={addRoot} className="mt-4">
            <Plus className="size-3.5 mr-1.5" /> Adicionar posição raiz
          </Button>
        </div>
      </div>

      {/* Legenda de uso */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-card border rounded-lg px-3 py-2 shadow-sm">
        <Label className="text-xs font-medium">Dica:</Label> clique em <Plus className="size-3 inline" /> para adicionar subordinado
      </div>
    </div>
  );
}
