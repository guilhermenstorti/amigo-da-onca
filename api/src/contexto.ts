import { conferirAssinatura, deB64url, type Sessao } from './cripto';
import { edicaoAtual, type Edicao } from './dados';
import { erro, type Env } from './http';

export interface Ctx {
  req: Request;
  env: Env;
  url: URL;
  params: string[];
  sessao: Sessao | null;
  /** Origem da própria API (para montar URLs de foto). */
  base: string;
}

export type Handler = (c: Ctx) => Promise<Response>;

export const ipDe = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'local';

export function exigirParticipante(c: Ctx): Sessao & { p: string } {
  if (!c.sessao?.p) throw erro(401, 'sem-perfil', 'Escolha quem você é primeiro.');
  return c.sessao as Sessao & { p: string };
}

export async function nomeDoAdmin(c: Ctx) {
  const linha = await c.env.DB.prepare('SELECT nome FROM participantes WHERE admin = 1 ORDER BY ordem LIMIT 1').first<{ nome: string }>();
  return linha?.nome ?? 'admin';
}

/** O perfil precisa estar no lobby por este aparelho (impede espiar o sorteio ou votar pelos outros). */
export async function exigirVinculo(c: Ctx): Promise<{ sessao: Sessao & { p: string }; ed: Edicao }> {
  const sessao = exigirParticipante(c);
  const ed = await edicaoAtual(c.env);
  const linha = await c.env.DB.prepare('SELECT aparelho_id FROM lobby WHERE ano = ? AND participante_id = ?')
    .bind(ed.ano, sessao.p)
    .first<{ aparelho_id: string }>();
  if (!linha) throw erro(403, 'fora-do-lobby', 'Você ainda não entrou no lobby desta edição.');
  if (linha.aparelho_id !== sessao.a) {
    throw erro(409, 'perfil-em-uso', `Seu perfil está em uso em outro celular. Peça pro ${await nomeDoAdmin(c)} liberar.`);
  }
  return { sessao, ed };
}

/** id do aparelho de um token com assinatura válida, mesmo que a palavra-chave tenha mudado. */
export async function aparelhoDoToken(c: Ctx): Promise<string | null> {
  const cab = c.req.headers.get('authorization');
  if (!cab?.startsWith('Bearer ')) return null;
  const [carga, assinatura] = cab.slice(7).split('.');
  if (!carga || !assinatura || !(await conferirAssinatura(c.env.TOKEN_SECRET, carga, assinatura))) return null;
  try {
    const a = (JSON.parse(new TextDecoder().decode(deB64url(carga))) as Sessao).a;
    return typeof a === 'string' ? a : null;
  } catch {
    return null;
  }
}

export function bytesDe(valor: unknown): Uint8Array {
  if (valor instanceof Uint8Array) return valor;
  if (valor instanceof ArrayBuffer) return new Uint8Array(valor);
  if (Array.isArray(valor)) return Uint8Array.from(valor as number[]);
  throw new Error('BLOB em formato inesperado');
}
