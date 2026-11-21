export interface Env {
  DB: D1Database;
  PALAVRA_CHAVE: string;
  ADMIN_PASSWORD: string;
  TOKEN_SECRET: string;
  /** Origens liberadas no CORS, separadas por vírgula. */
  ORIGENS: string;
}

export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const erro = (status: number, codigo: string, mensagem: string) => new ErroHttp(status, codigo, mensagem);

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const ok = () => json({ ok: true });

export function cabecalhosCors(req: Request, env: Env): Record<string, string> {
  const origem = req.headers.get('origin');
  const permitidas = env.ORIGENS.split(',').map((s) => s.trim());
  if (!origem || !permitidas.includes(origem)) return {};
  return { 'access-control-allow-origin': origem, vary: 'Origin' };
}

export async function lerCorpo<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw erro(400, 'corpo-invalido', 'Pedido inválido.');
  }
}

export const agora = () => Math.floor(Date.now() / 1000);
