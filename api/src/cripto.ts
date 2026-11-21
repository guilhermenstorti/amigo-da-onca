import { agora, erro, type Env } from './http';

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const chaves = new Map<string, Promise<CryptoKey>>();
function chave(segredo: string): Promise<CryptoKey> {
  let k = chaves.get(segredo);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    chaves.set(segredo, k);
  }
  return k;
}

export async function assinar(segredo: string, texto: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await chave(segredo), enc.encode(texto)));
}

export async function conferirAssinatura(segredo: string, texto: string, assinatura: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', await chave(segredo), deB64url(assinatura), enc.encode(texto));
  } catch {
    return false;
  }
}

/** Comparação em tempo constante (compara os hashes, não as strings). */
export async function iguais(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

/** Normaliza a palavra-chave: sem acento, sem maiúscula, sem espaço nas pontas (o teclado do iPhone capitaliza). */
export const normalizarPalavra = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Impressão digital de um segredo, derivada com o TOKEN_SECRET (não dá para descobrir o segredo a partir dela).
 * Vai dentro do token: trocar a palavra-chave ou a senha de admin invalida as sessões antigas.
 */
export const digital = async (env: Env, rotulo: string, segredo: string) =>
  (await assinar(env.TOKEN_SECRET, `${rotulo}:${segredo}`)).slice(0, 16);

export interface Sessao {
  /** id do aparelho */
  a: string;
  /** id do participante */
  p?: string;
  adm?: boolean;
  /** digital da palavra-chave */
  kv: string;
  /** digital da senha de admin */
  av?: string;
  exp: number;
}

const DIAS = 86400;

export async function emitirToken(env: Env, dados: { a: string; p?: string; adm?: boolean }): Promise<string> {
  const sessao: Sessao = { a: dados.a, kv: await digital(env, 'kv', normalizarPalavra(env.PALAVRA_CHAVE)), exp: agora() + 120 * DIAS };
  if (dados.p) sessao.p = dados.p;
  if (dados.adm) {
    sessao.adm = true;
    sessao.av = await digital(env, 'av', env.ADMIN_PASSWORD);
  }
  const carga = b64url(enc.encode(JSON.stringify(sessao)));
  return `${carga}.${await assinar(env.TOKEN_SECRET, carga)}`;
}

export async function lerToken(env: Env, req: Request): Promise<Sessao | null> {
  const cab = req.headers.get('authorization');
  if (!cab?.startsWith('Bearer ')) return null;
  const [carga, assinatura] = cab.slice(7).split('.');
  if (!carga || !assinatura) return null;
  if (!(await conferirAssinatura(env.TOKEN_SECRET, carga, assinatura))) return null;
  let s: Sessao;
  try {
    s = JSON.parse(new TextDecoder().decode(deB64url(carga))) as Sessao;
  } catch {
    return null;
  }
  if (typeof s.a !== 'string' || s.exp < agora()) return null;
  if (s.kv !== (await digital(env, 'kv', normalizarPalavra(env.PALAVRA_CHAVE)))) return null;
  if (s.adm && s.av !== (await digital(env, 'av', env.ADMIN_PASSWORD))) s.adm = false;
  return s;
}

/** Limite de tentativas erradas por chave (ex.: IP). Só conta falhas. */
export async function conferirLimite(env: Env, chave: string, max: number, janela: number) {
  const linha = await env.DB.prepare('SELECT contagem, janela FROM tentativas WHERE chave = ?')
    .bind(chave)
    .first<{ contagem: number; janela: number }>();
  if (linha && agora() - linha.janela < janela && linha.contagem >= max) {
    throw erro(429, 'muitas-tentativas', 'Muitas tentativas erradas. Espera uns minutinhos e tenta de novo.');
  }
}

export async function registrarFalha(env: Env, chave: string, janela: number) {
  const t = agora();
  await env.DB.prepare(
    `INSERT INTO tentativas (chave, contagem, janela) VALUES (?1, 1, ?2)
     ON CONFLICT (chave) DO UPDATE SET
       contagem = CASE WHEN ?2 - janela >= ?3 THEN 1 ELSE contagem + 1 END,
       janela = CASE WHEN ?2 - janela >= ?3 THEN ?2 ELSE janela END`,
  )
    .bind(chave, t, janela)
    .run();
}
