import type { AnoHall, Revelacao } from '../contrato';
import { aparelhoDoToken, bytesDe, ipDe, nomeDoAdmin, type Ctx } from '../contexto';
import { conferirLimite, emitirToken, iguais, normalizarPalavra, registrarFalha } from '../cripto';
import { conferirUrlFoto, edicaoAtual, montarEstado, tocar } from '../dados';
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

export async function hall(c: Ctx) {
  const { results } = await c.env.DB.prepare(
    `SELECT e.ano, e.data, e.local, ec.categoria_id, ec.nome AS categoria, r.vencedor_id, p.nome AS vencedor
     FROM edicoes e
     JOIN edicao_categorias ec ON ec.ano = e.ano
     LEFT JOIN resultados r ON r.ano = ec.ano AND r.categoria_id = ec.categoria_id
     LEFT JOIN participantes p ON p.id = r.vencedor_id
     WHERE e.fase = 'encerrada'
     ORDER BY e.ano DESC, ec.ordem, p.nome`,
  ).all<{ ano: number; data: string | null; local: string | null; categoria_id: string; categoria: string; vencedor_id: string | null; vencedor: string | null }>();

  const anos: AnoHall[] = [];
  for (const l of results) {
    let ano = anos.find((a) => a.ano === l.ano);
    if (!ano) anos.push((ano = { ano: l.ano, data: l.data, local: l.local, categorias: [] }));
    let cat = ano.categorias.find((k) => k.id === l.categoria_id);
    if (!cat) ano.categorias.push((cat = { id: l.categoria_id, nome: l.categoria, vencedores: [] }));
    if (l.vencedor_id && l.vencedor) cat.vencedores.push({ id: l.vencedor_id, nome: l.vencedor });
  }
  return json(anos);
}
