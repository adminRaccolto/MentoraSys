"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { editarModelo, salvarConteudo } from "@/actions/modelos";
import { TipoModelo } from "@/lib/generated/prisma";

interface Modelo {
  id: string;
  nome: string;
  tipo: TipoModelo;
  conteudo: string;
}

interface Props {
  modelo: Modelo;
}

const TIPO_LABELS: Record<TipoModelo, string> = {
  CONTRATO: "Contrato",
  PROPOSTA: "Proposta",
  RECIBO: "Recibo",
  GENERICO: "Genérico",
};

const TIPO_COLORS: Record<TipoModelo, string> = {
  CONTRATO: "bg-blue-100 text-blue-700",
  PROPOSTA: "bg-amber-100 text-amber-700",
  RECIBO: "bg-green-100 text-green-700",
  GENERICO: "bg-slate-100 text-slate-600",
};

const VARIAVEIS_COMUNS = [
  { chave: "{{data_hoje}}", label: "Data de hoje" },
  { chave: "{{empresa.nome}}", label: "Nome da empresa" },
  { chave: "{{empresa.cnpj}}", label: "CNPJ da empresa" },
  { chave: "{{empresa.logo_url}}", label: "Logo (URL)" },
  { chave: "{{empresa.telefone}}", label: "Telefone da empresa" },
  { chave: "{{empresa.email}}", label: "E-mail da empresa" },
  { chave: "{{empresa.endereco}}", label: "Endereço" },
  { chave: "{{empresa.cidade}}", label: "Cidade" },
  { chave: "{{empresa.estado}}", label: "Estado (UF)" },
  { chave: "{{empresa.site}}", label: "Site" },
];

const VARIAVEIS_CLIENTE = [
  { chave: "{{cliente.nome}}", label: "Nome do cliente" },
  { chave: "{{cliente.cpf_cnpj}}", label: "CPF/CNPJ do cliente" },
  { chave: "{{cliente.email}}", label: "E-mail do cliente" },
  { chave: "{{cliente.telefone}}", label: "Telefone do cliente" },
];

const VARIAVEIS_CONTRATO = [
  { chave: "{{contrato.titulo}}", label: "Título do contrato" },
  { chave: "{{contrato.valor_total}}", label: "Valor total" },
  { chave: "{{contrato.data_inicio}}", label: "Data de início" },
  { chave: "{{contrato.data_fim}}", label: "Data de encerramento" },
];

const VARIAVEIS_PROPOSTA = [
  { chave: "{{proposta.titulo}}", label: "Título da proposta" },
  { chave: "{{proposta.objeto}}", label: "Objeto / escopo" },
  { chave: "{{proposta.introducao}}", label: "Introdução" },
  { chave: "{{proposta.condicoes}}", label: "Condições gerais" },
  { chave: "{{proposta.valor_total}}", label: "Valor total" },
  { chave: "{{proposta.validade}}", label: "Data de validade" },
  { chave: "{{proposta.forma_pagamento}}", label: "Forma de pagamento" },
  { chave: "{{proposta.periodicidade}}", label: "Periodicidade" },
  { chave: "{{proposta.numero_parcelas}}", label: "Nº de parcelas" },
  { chave: "{{proposta.primeiro_vencimento}}", label: "1º vencimento" },
  { chave: "{{proposta.contato_nome}}", label: "Contato (nome)" },
  { chave: "{{proposta.contato_email}}", label: "Contato (e-mail)" },
  { chave: "{{proposta.contato_telefone}}", label: "Contato (telefone)" },
  { chave: "{{proposta.responsavel}}", label: "Responsável interno" },
  { chave: "{{proposta.tabela_itens}}", label: "Tabela de itens (HTML)" },
  { chave: "{{proposta.tabela_parcelas}}", label: "Tabela de parcelas (HTML)" },
];

const VARIAVEIS_RECIBO = [
  { chave: "{{recebivel.descricao}}", label: "Descrição" },
  { chave: "{{recebivel.valor}}", label: "Valor pago" },
  { chave: "{{recebivel.data_pagamento}}", label: "Data do pagamento" },
  { chave: "{{recebivel.forma_pagamento}}", label: "Forma de pagamento" },
  { chave: "{{recebivel.numero_parcela}}", label: "Número da parcela" },
];

function variavelPorTipo(tipo: TipoModelo) {
  const categorias = [{ label: "Geral", items: VARIAVEIS_COMUNS }];
  if (tipo === "CONTRATO" || tipo === "PROPOSTA" || tipo === "RECIBO") {
    categorias.push({ label: "Cliente", items: VARIAVEIS_CLIENTE });
  }
  if (tipo === "CONTRATO") {
    categorias.push({ label: "Contrato", items: VARIAVEIS_CONTRATO });
  }
  if (tipo === "PROPOSTA") {
    categorias.push({ label: "Proposta", items: VARIAVEIS_PROPOSTA });
  }
  if (tipo === "RECIBO") {
    categorias.push({ label: "Recibo", items: VARIAVEIS_RECIBO });
  }
  return categorias;
}

function CategoriaVariaveis({
  label,
  items,
  onInserir,
}: {
  label: string;
  items: { chave: string; label: string }[];
  onInserir: (chave: string) => void;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ChevronDown className={`size-3 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="pb-2 space-y-1">
          {items.map((v) => (
            <button
              key={v.chave}
              type="button"
              onClick={() => onInserir(v.chave)}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 hover:text-primary transition-colors group"
            >
              <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary/70 block">
                {v.chave}
              </span>
              <span className="text-foreground">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditorClient({ modelo }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nome, setNome] = useState(modelo.nome);
  const [salvo, setSalvo] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: "Comece a escrever o documento..." }),
    ],
    content: modelo.conteudo || "",
    onUpdate: ({ editor }) => {
      setSalvo(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        salvarConteudo(modelo.id, editor.getHTML()).then(() => setSalvo(true));
      }, 1500);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleNomeBlur = useCallback(() => {
    if (nome !== modelo.nome) {
      startTransition(async () => {
        await editarModelo(modelo.id, { nome });
      });
    }
  }, [nome, modelo.id, modelo.nome]);

  const inserirVariavel = (chave: string) => {
    editor?.commands.insertContent(chave);
    editor?.commands.focus();
  };

  const categorias = variavelPorTipo(modelo.tipo);

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${
        active ? "bg-muted text-primary" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/modelos")}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={handleNomeBlur}
          className="max-w-xs font-medium border-transparent hover:border-input focus:border-input h-8"
        />

        <Badge className={`${TIPO_COLORS[modelo.tipo]} border-0`} variant="outline">
          {TIPO_LABELS[modelo.tipo]}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {salvo ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-green-500" />
              Salvo
            </span>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" />
              Salvando...
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/modelos/${modelo.id}/preview`, "_blank")}
          >
            <Eye className="size-4 mr-1.5" />
            Visualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-muted/30 shrink-0 flex-wrap">
            <ToolbarButton
              title="Negrito"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive("bold")}
            >
              <Bold className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Itálico"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive("italic")}
            >
              <Italic className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Sublinhado"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive("underline")}
            >
              <UnderlineIcon className="size-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarButton
              title="Alinhar à esquerda"
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
              active={editor?.isActive({ textAlign: "left" })}
            >
              <AlignLeft className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Centralizar"
              onClick={() => editor?.chain().focus().setTextAlign("center").run()}
              active={editor?.isActive({ textAlign: "center" })}
            >
              <AlignCenter className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Alinhar à direita"
              onClick={() => editor?.chain().focus().setTextAlign("right").run()}
              active={editor?.isActive({ textAlign: "right" })}
            >
              <AlignRight className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Justificar"
              onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
              active={editor?.isActive({ textAlign: "justify" })}
            >
              <AlignJustify className="size-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarButton
              title="Lista com marcadores"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive("bulletList")}
            >
              <List className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Lista numerada"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive("orderedList")}
            >
              <ListOrdered className="size-4" />
            </ToolbarButton>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-3xl mx-auto min-h-full">
              <EditorContent
                editor={editor}
                className="prose prose-slate max-w-none focus:outline-none [&_.ProseMirror]:min-h-[500px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
              />
            </div>
          </div>
        </div>

        {/* Paleta de variáveis */}
        <div className="w-72 shrink-0 overflow-y-auto bg-muted/20">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Variáveis</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique para inserir no cursor
            </p>
          </div>
          <div className="px-3 py-2 space-y-1">
            {categorias.map((cat) => (
              <CategoriaVariaveis key={cat.label} label={cat.label} items={cat.items} onInserir={inserirVariavel} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
