import type { Estado, Fase, Pessoa } from './contrato';
import { assinar, digital, iguais, normalizarPalavra, type Sessao } from './cripto';
import { agora, erro, type Env } from './http';

export interface Edicao {
  ano: number;
  data: string | null;
  local: string | null;
  fase: Fase;
  categorias_reveladas: number;
  versao: number;
}

export async function edicaoAtual(env: Env): Promise<Edicao> {
  const ed = await env.DB.prepare('SELECT ano, data, local, fase, categorias_reveladas, versao FROM edicoes WHERE atual = 1 LIMIT 1').first<Edicao>();
  if (!ed) throw erro(404, 'sem-edicao', 'Nenhuma edição ativa ainda.');
  return ed;
}

/** Statement que incrementa a versão da edição (todo mundo recarrega o estado). */
export const tocar = (env: Env, ano: number) => env.DB.prepare('UPDATE edicoes SET versao = versao + 1 WHERE ano = ?').bind(ano);

export async function idsDaEdicao(env: Env, ano: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT ep.participante_id AS id FROM edicao_participantes ep
     JOIN participantes p ON p.id = ep.participante_id WHERE ep.ano = ? ORDER BY p.ordem, p.id`,
  )
    .bind(ano)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

export function exigirFase(ed: Edicao, ...fases: Fase[]) {
  if (!fases.includes(ed.fase)) throw erro(409, 'fase', mensagensFase[ed.fase]);
}

const mensagensFase: Record<Fase, string> = {
  preparacao: 'O sorteio ainda não abriu.',
  lobby: 'O lobby do sorteio está aberto.',
  troca: 'Agora é a hora da troca de presentes.',
  votacao: 'A votação está aberta.',
  revelacao: 'A votação já fechou: hora da revelação.',
  encerrada: 'Essa edição já terminou.',
};

// ---------- Fotos com URL assinada (o <img> não manda header de autorização) ----------

const JANELA_FOTO = 15 * 86400;

async function assinaturaFoto(env: Env, id: string, tamanho: number, versao: number, exp: number) {
  const kv = await digital(env, 'kv', normalizarPalavra(env.PALAVRA_CHAVE));
  return `foto:${id}:${tamanho}:${versao}:${exp}:${kv}`;
}

export async function urlFoto(env: Env, base: string, id: string, tamanho: 256 | 512, versao: number) {
  // Expiração arredondada: a URL fica igual por até 15 dias e o navegador reaproveita o cache.
  const exp = (Math.floor(agora() / JANELA_FOTO) + 2) * JANELA_FOTO;
  const sig = (await assinar(env.TOKEN_SECRET, await assinaturaFoto(env, id, tamanho, versao, exp))).slice(0, 22);
  return `${base}/fotos/${id}/${tamanho}?v=${versao}&e=${exp}&s=${sig}`;
}

export async function conferirUrlFoto(env: Env, id: string, tamanho: number, url: URL) {
  const versao = Number(url.searchParams.get('v'));
  const exp = Number(url.searchParams.get('e'));
  const sig = url.searchParams.get('s') ?? '';
  if (!versao || !exp || exp < agora()) return false;
  const esperado = (await assinar(env.TOKEN_SECRET, await assinaturaFoto(env, id, tamanho, versao, exp))).slice(0, 22);
  return iguais(sig, esperado);
}

// ---------- Estado ----------

interface LinhaPessoa {
  id: string;
  nome: string;
  admin: number;
  foto_v: number | null;
  na_edicao: number;
}

export async function montarEstado(env: Env, base: string, sessao: Sessao): Promise<Estado> {
  const ed = await edicaoAtual(env);
  const [pessoasR, lobbyR, cedulasR, categoriasR, sorteioR] = await env.DB.batch([
    env.DB.prepare(
      `SELECT p.id, p.nome, p.admin,
         (SELECT max(f.versao) FROM fotos f WHERE f.participante_id = p.id) AS foto_v,
         EXISTS (SELECT 1 FROM edicao_participantes ep WHERE ep.ano = ?1 AND ep.participante_id = p.id) AS na_edicao
       FROM participantes p WHERE p.ativo = 1 ORDER BY p.ordem, p.id`,
    ).bind(ed.ano),
    env.DB.prepare('SELECT participante_id, aparelho_id FROM lobby WHERE ano = ? ORDER BY entrou_em, participante_id').bind(ed.ano),
    env.DB.prepare('SELECT eleitor_id FROM cedulas WHERE ano = ?').bind(ed.ano),
    env.DB.prepare('SELECT categoria_id AS id, nome, descricao FROM edicao_categorias WHERE ano = ? ORDER BY ordem').bind(ed.ano),
    env.DB.prepare('SELECT doador_id FROM sorteio WHERE ano = ?').bind(ed.ano),
  ]);

  const linhas = pessoasR.results as unknown as LinhaPessoa[];
  const lobby = lobbyR.results as unknown as { participante_id: string; aparelho_id: string }[];
  const cedulas = new Set((cedulasR.results as unknown as { eleitor_id: string }[]).map((c) => c.eleitor_id));
  const categorias = categoriasR.results as unknown as { id: string; nome: string; descricao: string }[];
  const comPar = new Set((sorteioR.results as unknown as { doador_id: string }[]).map((s) => s.doador_id));

  const pessoas: Pessoa[] = await Promise.all(
    linhas.map(async (l) => ({
      id: l.id,
      nome: l.nome,
      admin: !!l.admin,
      naEdicao: !!l.na_edicao,
      foto: l.foto_v ? { p: await urlFoto(env, base, l.id, 256, l.foto_v), g: await urlFoto(env, base, l.id, 512, l.foto_v) } : null,
    })),
  );
  const daEdicao = linhas.filter((l) => l.na_edicao).map((l) => l.id);
  const presentes = lobby.map((l) => l.participante_id).filter((id) => daEdicao.includes(id));

  let eu: Estado['eu'] = null;
  const minha = sessao.p ? linhas.find((l) => l.id === sessao.p) : undefined;
  if (minha) {
    const vinculoLinha = lobby.find((l) => l.participante_id === minha.id);
    eu = {
      id: minha.id,
      admin: !!(sessao.adm && minha.admin),
      vinculo: vinculoLinha ? (vinculoLinha.aparelho_id === sessao.a ? 'este' : 'outro') : null,
      tirouAlguem: comPar.has(minha.id),
      votosEnviados: cedulas.has(minha.id),
    };
  }

  const estado: Estado = {
    versao: ed.versao,
    edicao: { ano: ed.ano, data: ed.data, local: ed.local, fase: ed.fase },
    pessoas,
    eu,
    lobby: { presentes, total: daEdicao.length, completo: daEdicao.length > 1 && presentes.length === daEdicao.length },
    votacao: { categorias, enviaram: daEdicao.filter((id) => cedulas.has(id)).length, total: daEdicao.length },
    revelacao: {
      reveladas: ed.fase === 'encerrada' ? categorias.length : ed.categorias_reveladas,
      total: categorias.length,
    },
  };
  if (eu?.admin) {
    estado.admin = {
      faltamNoLobby: daEdicao.filter((id) => !presentes.includes(id)),
      faltamVotar: daEdicao.filter((id) => !cedulas.has(id)),
    };
  }
  return estado;
}
