const AUTHENTIQUE_API = "https://api.autentique.com.br/v2/graphql";

export interface AutentiqueSignatario {
  email: string;
  nome: string;
}

export interface AutentiqueDocumento {
  id: string;
  nome: string;
  link_assinatura?: string;
  signatarios: Array<{
    email: string;
    link: string;
    action: { name: string };
  }>;
}

const CREATE_DOCUMENT_MUTATION = `
  mutation CreateDocumentMutation(
    $document: DocumentInput!
    $signers: [SignerInput!]!
    $file: Upload!
  ) {
    createDocument(document: $document, signers: $signers, file: $file) {
      id
      name
      signatures {
        public_id
        email
        link { short_link }
        action { name }
      }
    }
  }
`;

const GET_DOCUMENT_QUERY = `
  query GetDocument($id: UUID!) {
    document(id: $id) {
      id
      name
      status { name }
      files {
        original
        signed
        pades
      }
      signatures {
        public_id
        email
        link { short_link }
        signed
        action { name }
      }
    }
  }
`;

export async function criarDocumentoAuthentique(params: {
  nome: string;
  mensagem?: string;
  htmlContent: string;
  pdfBuffer?: ArrayBuffer;
  signatarios: AutentiqueSignatario[];
  sandbox?: boolean;
}): Promise<{ id: string; signatarios: Array<{ email: string; link: string }> }> {
  const apiKey = process.env.AUTHENTIQUE_API_KEY;
  if (!apiKey) throw new Error("AUTHENTIQUE_API_KEY não configurada");

  const { nome, mensagem, htmlContent, pdfBuffer, signatarios, sandbox = false } = params;

  const signers = signatarios.map((s) => ({
    email: s.email,
    name: s.nome,
    action: "SIGN",
  }));

  const operations = JSON.stringify({
    query: CREATE_DOCUMENT_MUTATION,
    variables: {
      document: {
        name: nome,
        message: mensagem ?? `Por favor, assine o documento: ${nome}`,
      },
      signers,
      file: null,
    },
  });

  const map = JSON.stringify({ "0": ["variables.file"] });

  const formData = new FormData();
  formData.append("operations", operations);
  formData.append("map", map);

  const nomeArquivo = nome.replace(/[^a-z0-9]/gi, "_");
  if (pdfBuffer) {
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    formData.append("0", pdfBlob, `${nomeArquivo}.pdf`);
  } else {
    const htmlBlob = new Blob([htmlContent], { type: "text/html" });
    formData.append("0", htmlBlob, `${nomeArquivo}.html`);
  }

  const res = await fetch(AUTHENTIQUE_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(`Authentique API error: ${JSON.stringify(json.errors)}`);
  }

  const doc = json.data?.createDocument;
  if (!doc?.id) throw new Error("Resposta inesperada da Authentique API");

  return {
    id: doc.id,
    signatarios: (doc.signatures ?? []).map((s: { email: string; link: { short_link: string } | string }) => ({
      email: s.email,
      link: typeof s.link === "string" ? s.link : s.link?.short_link ?? "",
    })),
  };
}

export async function buscarDocumentoAuthentique(id: string): Promise<{
  id: string;
  status: string;
  pdf_assinado_url: string | null;
} | null> {
  const apiKey = process.env.AUTHENTIQUE_API_KEY;
  if (!apiKey) throw new Error("AUTHENTIQUE_API_KEY não configurada");

  const res = await fetch(AUTHENTIQUE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_DOCUMENT_QUERY,
      variables: { id },
    }),
  });

  const json = await res.json();
  const doc = json.data?.document;
  if (!doc) return null;

  return {
    id: doc.id,
    status: doc.status?.name ?? "UNKNOWN",
    pdf_assinado_url: doc.files?.signed ?? null,
  };
}
