import type { AnoHall, Fase, PinHall, PremiacaoHall, Revelacao, VencedorHall } from '../contrato';
import { aparelhoDoToken, bytesDe, ipDe, nomeDoAdmin, type Ctx } from '../contexto';
import { conferirLimite, emitirToken, iguais, normalizarPalavra, registrarFalha } from '../cripto';
import { conferirUrlFoto, edicaoAtual, montarEstado, tocar, urlFoto } from '../dados';
import { agora, erro, json, lerCorpo } from '../http';

const JANELA = 15 * 60;

/** Palavra-chave do grupo → token do aparelho. */
export async function acesso(c: Ctx) {
  const chave = `acesso:${ipDe(c.req)}`;
  // Generoso: na festa, os 9 celulares saem pelo mesmo IP do Wi-Fi.
  await conferirLimite(c.env, chave, 25, JANELA);
  const { palavra } = await lerCorpo<{ palavra?: string }>(c.req);
  if (typeof palavra !== 'string' || !(await iguais(normalizarPalavra(palavra), normalizarPalavra(c.env.PALAVRA_CHAVE)))) {
    await registrarFalha(c.env, chave, JANELA);
    throw erro(401, 'palavra', 'Não é essa. Confere no grupo?');
  }
  const a = (await aparelhoDoToken(c)) ?? crypto.randomUUID();
  return json({ token: await emitirToken(c.env, { a }) });
}

/** Escolhe o perfil ("Quem é você?"). O admin precisa da senha. */
export async function criarSessao(c: Ctx) {
  const s = c.sessao!;
  const { participante, senha } = await lerCorpo<{ participante?: string; senha?: string }>(c.req);
  const p = await c.env.DB.prepare('SELECT id, nome, admin FROM participantes WHERE id = ? AND ativo = 1')
    .bind(participante ?? '')
    .first<{ id: string; nome: string; admin: number }>();
  if (!p) throw erro(404, 'participante', 'Perfil não encontrado.');

  let adm = false;
  if (p.admin) {
    const chave = `admin:${ipDe(c.req)}`;
    await conferirLimite(c.env, chave, 10, JANELA);
    if (typeof senha !== 'string' || !(await iguais(senha, c.env.ADMIN_PASSWORD))) {
      await registrarFalha(c.env, chave, JANELA);
      throw erro(401, 'senha', senha ? 'Senha errada.' : 'Esse perfil precisa da senha de admin.');
    }
    adm = true;
  }

  const ed = await edicaoAtual(c.env).catch(() => null);
  if (ed) {
    const { results } = await c.env.DB.prepare(
      `SELECT l.participante_id, l.aparelho_id, p.nome FROM lobby l JOIN participantes p ON p.id = l.participante_id
       WHERE l.ano = ? AND (l.participante_id = ? OR l.aparelho_id = ?)`,
    )
      .bind(ed.ano, p.id, s.a)
      .all<{ participante_id: string; aparelho_id: string; nome: string }>();
    const doAparelho = results.find((r) => r.aparelho_id === s.a);
    const doPerfil = results.find((r) => r.participante_id === p.id);
    if (doAparelho && doAparelho.participante_id !== p.id) {
      throw erro(409, 'aparelho-em-uso', `Este celular já está no lobby como ${doAparelho.nome}. Peça pro ${await nomeDoAdmin(c)} liberar.`);
    }
    if (doPerfil && doPerfil.aparelho_id !== s.a) {
      if (!adm) {
        throw erro(409, 'perfil-em-uso', `O perfil de ${p.nome} já está em uso em outro celular. Se for você, peça pro ${await nomeDoAdmin(c)} liberar.`);
      }
      // O admin provou quem é com a senha: o perfil dele passa para este aparelho.
      await c.env.DB.batch([
        c.env.DB.prepare('UPDATE lobby SET aparelho_id = ? WHERE ano = ? AND participante_id = ?').bind(s.a, ed.ano, p.id),
        tocar(c.env, ed.ano),
      ]);
    }
  }
  return json({ token: await emitirToken(c.env, { a: s.a, p: p.id, adm }) });
}

export async function estado(c: Ctx) {
  const v = Number(c.url.searchParams.get('v'));
  if (v) {
    const linha = await c.env.DB.prepare('SELECT versao FROM edicoes WHERE atual = 1').first<{ versao: number }>();
    if (linha?.versao === v) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
  return json(await montarEstado(c.env, c.base, c.sessao!));
}

export async function foto(c: Ctx) {
  const [id, tam] = c.params;
  const tamanho = Number(tam);
  if (!(await conferirUrlFoto(c.env, id, tamanho, c.url))) return new Response('Proibido', { status: 403 });
  const linha = await c.env.DB.prepare('SELECT bytes, mime FROM fotos WHERE participante_id = ? AND tamanho = ?')
    .bind(id, tamanho)
    .first<{ bytes: unknown; mime: string }>();
  if (!linha) return new Response('Sem foto', { status: 404 });
  const idade = Math.max(60, Math.min(Number(c.url.searchParams.get('e')) - agora(), 30 * 86400));
  return new Response(bytesDe(linha.bytes), {
    headers: { 'content-type': linha.mime, 'cache-control': `private, max-age=${idade}, immutable` },
  });
}

export async function revelacao(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const vazio: Revelacao = { disponivel: false, reveladas: 0, total: 0, categorias: [] };
  if (ed.fase !== 'revelacao' && ed.fase !== 'encerrada') return json(vazio);

  const [catR, resR, jusR] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT categoria_id AS id, nome, descricao FROM edicao_categorias WHERE ano = ? ORDER BY ordem').bind(ed.ano),
    c.env.DB.prepare(
      `SELECT r.categoria_id, r.vencedor_id AS id, p.nome FROM resultados r
       JOIN participantes p ON p.id = r.vencedor_id WHERE r.ano = ? ORDER BY p.nome`,
    ).bind(ed.ano),
    c.env.DB.prepare('SELECT categoria_id, texto FROM justificativas WHERE ano = ? ORDER BY posicao').bind(ed.ano),
  ]);
  const categorias = catR.results as unknown as { id: string; nome: string; descricao: string }[];
  const resultados = resR.results as unknown as { categoria_id: string; id: string; nome: string }[];
  const justificativas = jusR.results as unknown as { categoria_id: string; texto: string }[];
  const reveladas = ed.fase === 'encerrada' ? categorias.length : ed.categorias_reveladas;

  const resposta: Revelacao = {
    disponivel: true,
    reveladas,
    total: categorias.length,
    categorias: categorias.map((cat, i) =>
      i < reveladas
        ? {
            ...cat,
            revelada: true,
            vencedores: resultados.filter((r) => r.categoria_id === cat.id).map(({ id, nome }) => ({ id, nome })),
            justificativas: justificativas.filter((j) => j.categoria_id === cat.id).map((j) => j.texto),
          }
        : { ...cat, revelada: false },
    ),
  };
  return json(resposta);
}

interface LinhaEdicaoHall {
  ano: number;
  data: string | null;
  local: string | null;
  fase: Fase;
  atual: number;
  categorias_reveladas: number;
  fotos_url: string | null;
}

/**
 * Hall da Fama: todas as edições, cada uma com a sua sala de troféus (um pin por categoria).
 * Na edição atual, o pin só sai com o vencedor depois que a categoria é revelada: nada em segredo vaza por aqui.
 */
export async function hall(c: Ctx) {
  const [edR, catR, resR, ativasR] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT ano, data, local, fase, atual, categorias_reveladas, fotos_url FROM edicoes ORDER BY ano DESC'),
    c.env.DB.prepare('SELECT ano, categoria_id AS id, nome FROM edicao_categorias ORDER BY ano, ordem'),
    c.env.DB.prepare(
      `SELECT r.ano, r.categoria_id, p.id, p.nome, (SELECT max(f.versao) FROM fotos f WHERE f.participante_id = p.id) AS foto_v
       FROM resultados r JOIN participantes p ON p.id = r.vencedor_id ORDER BY p.nome`,
    ),
    c.env.DB.prepare('SELECT id, nome FROM categorias WHERE ativa = 1 ORDER BY ordem, id'),
  ]);
  const edicoes = edR.results as unknown as LinhaEdicaoHall[];
  const categorias = catR.results as unknown as { ano: number; id: string; nome: string }[];
  const resultados = resR.results as unknown as { ano: number; categoria_id: string; id: string; nome: string; foto_v: number | null }[];
  // Anos sem premiação (e a edição atual antes da votação) mostram a sombra dos pins de hoje.
  const sombras: PinHall[] = (ativasR.results as unknown as { id: string; nome: string }[]).map((k) => ({ ...k, vencedores: null }));

  const vencedores = async (ano: number, categoria: string): Promise<VencedorHall[]> =>
    Promise.all(
      resultados
        .filter((r) => r.ano === ano && r.categoria_id === categoria)
        .map(async (r) => ({
          id: r.id,
          nome: r.nome,
          foto: r.foto_v ? { p: await urlFoto(c.env, c.base, r.id, 256, r.foto_v), g: await urlFoto(c.env, c.base, r.id, 512, r.foto_v) } : null,
        })),
    );

  const anos: AnoHall[] = await Promise.all(
    edicoes.map(async (e) => {
      const doAno = categorias.filter((k) => k.ano === e.ano);
      let premiacao: PremiacaoHall;
      if (e.atual && e.fase !== 'encerrada') premiacao = e.fase === 'revelacao' ? 'revelando' : 'em-breve';
      else premiacao = doAno.length ? 'completa' : 'sem';

      let pins: PinHall[];
      if (premiacao === 'sem' || (premiacao === 'em-breve' && !doAno.length)) pins = sombras;
      else {
        // 'em-breve' com categorias = votação aberta: só as sombras. 'revelando': só as já reveladas.
        const entregues = premiacao === 'completa' ? doAno.length : premiacao === 'revelando' ? e.categorias_reveladas : 0;
        pins = await Promise.all(
          doAno.map(async (k, i) => ({ id: k.id, nome: k.nome, vencedores: i < entregues ? await vencedores(e.ano, k.id) : null })),
        );
      }
      return { ano: e.ano, data: e.data, local: e.local, atual: !!e.atual, premiacao, pins, fotosUrl: e.fotos_url };
    }),
  );
  return json(anos);
}
