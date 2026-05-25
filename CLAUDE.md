@AGENTS.md

# MentoraSys — Contexto do Projeto

## O que é este projeto
SaaS multiempresa para empresa de consultoria em gestão financeira, administrativa, estratégica e agroempresarial. Reescrita completa do sistema anterior (Raccolto).

## Stack
- **Frontend + API:** Next.js 16 (App Router + Server Actions + Route Handlers)
- **UI:** TailwindCSS v4 + shadcn/ui
- **Estado:** Zustand (local) + TanStack Query (server state)
- **Banco:** Supabase PostgreSQL
- **Auth:** Supabase Auth (JWT, refresh automático)
- **Storage:** Supabase Storage (buckets com RLS)
- **Realtime:** Supabase Realtime (notificações)
- **Multitenancy:** Supabase Row Level Security (RLS por empresa_id)
- **ORM:** Prisma
- **Jobs:** Supabase Edge Functions (Deno) — PDF, e-mails, webhooks
- **E-mail:** Resend
- **CI/CD:** GitHub Actions → Vercel

## Identidade Visual
- Fundo/base: **Branco** (#FFFFFF)
- Sidebar/botões primários: **Azul petróleo** (#1B4F72) — var `--primary` / `--sidebar`
- Destaque/CTAs: **Mostarda** (#D4AC0D) — var `--accent`
- Complemento: **Azul claro** (#AED6F1)
- Surface: #F8FAFC | Border: #E2E8F0 | Texto: #1E293B

## Fluxo central
CRM → Lead → Proposta → Aceite público → Contrato → Autentique → Assinado → Carregar Financeiro → Gerar Projeto → Tarefas → Portal do Cliente

## Estrutura de rotas
- `(auth)/` — Login, recuperar senha, selecionar empresa
- `(internal)/` — Área da equipe (sidebar navy)
- `(portal)/` — Portal do cliente (layout minimalista)
- `(public)/p/[token]` — Aceite de proposta sem login

## Regras de desenvolvimento
1. Todo Server Action valida permissão com `verificarPermissao(recurso, acao)` antes de qualquer operação
2. Nunca filtrar por empresa_id manualmente — o RLS do Supabase cuida disso
3. Criação/edição sempre por modal, mantendo a lista visível ao fundo
4. Clique na linha da lista abre o detalhe do item
5. Formulários usam react-hook-form + Zod para validação
6. Comunicação em **português brasileiro**
7. Comentários no código apenas quando o "por quê" não é óbvio

## Módulos (18)
1. Multiempresa & Configurações | 2. Perfis & Permissões (RBAC) | 3. Cadastros
4. Modelos de Documentos | 5. CRM Comercial | 6. Propostas | 7. Contratos
8. Gestão de Projetos | 9. Tarefas & Etapas | 10. Documentos & Repositório
11. Portal do Cliente | 12. Financeiro | 13. Faturamento | 14. Agenda
15. Notificações | 16. Diagramas & Diagnósticos | 17. Relatórios | 18. Auditoria

## Ordem de implementação
- Fase 0: Schema Prisma + Auth + Multiempresa + RBAC
- Fase 1: Clientes, Serviços, CRM, Propostas, Contratos
- Fase 2: Projetos, Tarefas, Documentos, Portal Cliente
- Fase 3: Financeiro core (recebíveis, contas a pagar, fluxo de caixa)
- Fase 4: Modelos de documento + geração de PDF
- Fase 5: Auditoria, Agenda, Dashboards completos
- Fase 6+: Diagramas, Diagnósticos, Faturamento, Integrações externas
