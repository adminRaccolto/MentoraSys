-- Modelos em que só a empresa assina (ex.: termo de sigilo unilateral) — idempotente
ALTER TABLE "modelos_documento" ADD COLUMN IF NOT EXISTS "cliente_assina" BOOLEAN NOT NULL DEFAULT true;

UPDATE "modelos_documento"
SET "cliente_assina" = false
WHERE "nome" = 'Termo de Confidencialidade e Sigilo';

-- Remove a linha de assinatura do cliente e centraliza a da empresa nesses termos
UPDATE "modelos_documento"
SET "conteudo" = replace(
  replace(
    regexp_replace(
      "conteudo",
      '\s*<td width="12%"></td>\s*<td width="44%"[^>]*>\s*\{\{cliente\.nome\}\}<br>\s*CPF/CNPJ: \{\{cliente\.cpf_cnpj\}\}\s*</td>',
      ''
    ),
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">',
    '<table width="50%" align="center" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
  ),
  '<td width="44%" align="center" style="border-top',
  '<td width="100%" align="center" style="border-top'
)
WHERE "nome" = 'Termo de Confidencialidade e Sigilo'
  AND "conteudo" LIKE '%<td width="12%"></td>%';
