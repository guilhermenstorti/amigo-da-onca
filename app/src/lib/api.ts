import { esquecerTudo, sairDoPerfil, token } from './sessao';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

interface Opcoes {
  /** Corpo binário (upload de foto). */
  bruto?: Blob;
  /** Token específico (ex.: o do aparelho, ao escolher o perfil). */
  token?: string | null;
}

export async function api<T = unknown>(metodo: string, caminho: string, corpo?: unknown, opcoes: Opcoes = {}): Promise<T> {
  const t = opcoes.token !== undefined ? opcoes.token : token.value;
  const headers: Record<string, string> = {};
  if (t) headers.authorization = `Bearer ${t}`;
  let body: BodyInit | undefined;
  if (opcoes.bruto) {
    body = opcoes.bruto;
    headers['content-type'] = opcoes.bruto.type;
  } else if (corpo !== undefined) {
    body = JSON.stringify(corpo);
    headers['content-type'] = 'application/json';
  }

  let r: Response;
  try {
    r = await fetch(BASE + caminho, { method: metodo, headers, body });
  } catch {
    throw new ErroApi(0, 'rede', 'Sem conexão. Confere a internet e tenta de novo.');
  }
  if (r.status === 204) return null as T;
  const dados = (await r.json().catch(() => null)) as { erro?: string; mensagem?: string } | null;
  if (!r.ok) {
    const e = new ErroApi(r.status, dados?.erro ?? 'erro', dados?.mensagem ?? 'Algo deu errado. Tenta de novo?');
    if (r.status === 401 && e.codigo === 'sem-acesso') esquecerTudo();
    if (r.status === 401 && e.codigo === 'sem-perfil') sairDoPerfil();
    throw e;
  }
  return dados as T;
}

export const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado. Tenta de novo?');
