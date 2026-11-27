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

Os perfis Administrador e Gestor recebem acesso pela migração de mentorias. Em **CRM → Ganho → Matricular mentorado**, confira os dados do cliente e escolha uma turma ou uma mentoria individual. Também é possível matricular um cliente diretamente em **Mentorias**. A matrícula envia um e-mail pelo Resend com um link de uso único, válido por sete dias, para o aluno criar a senha. Em **Alunos**, a equipe pode reenviar o convite, copiar o link ou gerar uma senha provisória. Depois de definir a senha, o aluno entra em `/portal/acesso` com e-mail e senha e vê as mentorias em que tem matrícula ativa. O Supabase Storage cria o bucket privado `mentorias-privadas` no primeiro anexo, com limite de 4 MB por arquivo.

### Integração com Zoom

Abra **Mentorias → Configurar Zoom** com um perfil que pode editar as configurações da empresa. Use um app [Server-to-Server OAuth do Zoom](https://developers.zoom.us/docs/internal-apps/s2s-oauth/) com permissões de criação, atualização e exclusão de reuniões. Informe o Account ID, o Client ID, o Client Secret e o anfitrião. O servidor cifra as credenciais por empresa usando `ZOOM_CONFIG_ENCRYPTION_KEY`, uma chave de 32 bytes em Base64. A chave é própria de cada ambiente e precisa ser preservada entre publicações.

Use a URL de webhook exibida na tela e cadastre o Secret Token para receber `meeting.participant_joined` e `recording.completed`. A entrada na sala é identificada pelo e-mail quando o Zoom o disponibiliza e há um único aluno correspondente na turma. A gravação automática exige que o anfitrião tenha gravação na nuvem habilitada. A equipe confere as permissões de compartilhamento da gravação no Zoom antes de publicá-la no portal.

Em **Mentorias → turma → Reuniões**, agende a reunião. Em seguida, crie a sala Zoom ou informe um link de videoconferência existente. Em **Alunos**, a equipe pode cadastrar ou redefinir o login do aluno. A redefinição gera uma senha provisória e encerra as sessões anteriores. A configuração anterior por variáveis `ZOOM_EMPRESA_ID`, `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_ID` e `ZOOM_WEBHOOK_SECRET_TOKEN` segue compatível com `/api/webhooks/zoom`.

### Espaço de projeto da mentoria

A gestão e o portal têm início com próximos encontros, notícias e atalhos, além das seções de calendário, páginas, mural e biblioteca. A busca encontra conteúdo dentro da mentoria a que o usuário tem acesso.

A equipe da empresa publica e edita páginas e notícias, organiza os materiais compartilhados por categoria e controla o acompanhamento das turmas, com responsáveis, prazos e conclusão. Os alunos da turma consultam a lista e podem fazer check-in nos encontros. Nas mentorias individuais, o aluno acompanha suas tarefas e envia documentos privados. A matrícula ativa controla a visualização no portal.
