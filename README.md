This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mentorias

Os perfis Administrador e Gestor recebem acesso pela migração de mentorias. Em **Mentorias**, crie uma turma de **A Mesa das Decisões** ou vincule um cliente a uma mentoria individual. O link gerado para um aluno dá acesso a uma mentoria por sete dias. O Supabase Storage cria o bucket privado `mentorias-privadas` no primeiro anexo, com limite de 4 MB por arquivo.

### Integração com Zoom

Os links de videoconferência e de gravação podem ser cadastrados pela equipe. Para criar salas pelo MentoraSys, configure um app [Server-to-Server OAuth do Zoom](https://developers.zoom.us/docs/internal-apps/s2s-oauth/) com permissões de criação, atualização e exclusão de reuniões e preencha estas variáveis no servidor.

- `ZOOM_EMPRESA_ID` identifica a empresa autorizada a usar a conta Zoom.
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` e `ZOOM_CLIENT_SECRET` identificam o app Zoom.
- `ZOOM_HOST_ID` é o ID ou o e-mail do usuário anfitrião.
- `ZOOM_WEBHOOK_SECRET_TOKEN` valida as solicitações enviadas pelo Zoom.

Cadastre `/api/webhooks/zoom` no domínio da aplicação como destino para `meeting.participant_joined` e `recording.completed`. A entrada na sala é identificada pelo e-mail quando o Zoom o disponibiliza e há um único aluno correspondente na turma. A gravação automática exige que o anfitrião tenha gravação na nuvem habilitada. A equipe confere as permissões de compartilhamento da gravação no Zoom antes de publicá-la no portal.
