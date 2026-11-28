import { apurar, type VotoApurado } from '../apuracao';
import type { Gestao } from '../contrato';
import type { Ctx } from '../contexto';
import { edicaoAtual, exigirFase, idsDaEdicao, tocar } from '../dados';
import { erro, json, lerCorpo, ok } from '../http';
import { embaralhar, sortearPares } from '../sorteio';

const faseAtual = (ano: number) => `(SELECT fase FROM edicoes WHERE ano = ${Number(ano)})`;

function exigirMudou(r: D1Result, mensagem: string) {
  if (!r.meta.changes) throw erro(409, 'fase', mensagem);
}

export function slug(texto: string) {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

// ---------- Fases da noite ----------

export async function abrirLobby(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  if ((await idsDaEdicao(c.env, ed.ano)).length < 2) throw erro(400, 'poucos', 'A edição precisa de pelo menos 2 participantes.');
  const r = await c.env.DB.prepare("UPDATE edicoes SET fase = 'lobby', versao = versao + 1 WHERE ano = ? AND fase = 'preparacao'").bind(ed.ano).run();
  exigirMudou(r, 'O lobby só abre na preparação.');
  return ok();
}

export async function fecharLobby(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const [r] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE edicoes SET fase = 'preparacao', versao = versao + 1 WHERE ano = ? AND fase = 'lobby'").bind(ed.ano),
    c.env.DB.prepare(`DELETE FROM lobby WHERE ano = ? AND ${faseAtual(ed.ano)} = 'preparacao'`).bind(ed.ano),
  ]);
  exigirMudou(r, 'O lobby não está aberto.');
  return ok();
}

/** Sorteia todos os pares de uma vez. Só com o lobby completo. Nunca devolve os pares. */
export async function sortear(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  if (ed.fase === 'troca') return json({ ok: true, jaSorteado: true });
  exigirFase(ed, 'lobby');
  const ids = await idsDaEdicao(c.env, ed.ano);
  const { results } = await c.env.DB.prepare('SELECT participante_id FROM lobby WHERE ano = ?').bind(ed.ano).all<{ participante_id: string }>();
  const presentes = new Set(results.map((r) => r.participante_id));
  const faltam = ids.filter((id) => !presentes.has(id));
  if (faltam.length) throw erro(409, 'lobby-incompleto', `Ainda falta${faltam.length > 1 ? 'm' : ''} ${faltam.length} no lobby.`);

  const pares = sortearPares(ids);
  const emLobby = `${faseAtual(ed.ano)} = 'lobby'`;
  const res = await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sorteio WHERE ano = ? AND ${emLobby}`).bind(ed.ano),
    ...pares.map(([doador, recebedor]) =>
      c.env.DB.prepare(`INSERT INTO sorteio (ano, doador_id, recebedor_id) SELECT ?, ?, ? WHERE ${emLobby}`).bind(ed.ano, doador, recebedor),
    ),
    c.env.DB.prepare("UPDATE edicoes SET fase = 'troca', sorteado_em = ?, versao = versao + 1 WHERE ano = ? AND fase = 'lobby'").bind(
      Date.now(),
      ed.ano,
    ),
  ]);
  if (!res[res.length - 1].meta.changes) return json({ ok: true, jaSorteado: true });

  // Conferência final: o banco tem exatamente um par por pessoa.
  const n = await c.env.DB.prepare('SELECT count(*) AS n FROM sorteio WHERE ano = ?').bind(ed.ano).first<{ n: number }>();
  if (n?.n !== ids.length) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM sorteio WHERE ano = ?').bind(ed.ano),
      c.env.DB.prepare("UPDATE edicoes SET fase = 'lobby', versao = versao + 1 WHERE ano = ?").bind(ed.ano),
    ]);
    throw erro(500, 'sorteio', 'O sorteio não fechou. Tenta de novo.');
  }
  return ok();
}

/**
 * Recomeça a edição atual do zero, em qualquer fase: apaga lobby, sorteio, votos, resultados e justificativas
 * e volta para a preparação. Mantém data, local, quem participa, pessoas, fotos e categorias.
 * Exige o ano no corpo, para ninguém apagar uma edição por engano.
 */
export async function recomecarEdicao(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const { ano } = await lerCorpo<{ ano?: number }>(c.req);
  if (Number(ano) !== ed.ano) throw erro(400, 'ano', `Confirme o ano da edição atual (${ed.ano}).`);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM justificativas WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM resultados WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM votos WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM cedulas WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM edicao_categorias WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM sorteio WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare('DELETE FROM lobby WHERE ano = ?').bind(ed.ano),
    c.env.DB.prepare(
      "UPDATE edicoes SET fase = 'preparacao', categorias_reveladas = 0, sorteado_em = NULL, versao = versao + 1 WHERE ano = ?",
    ).bind(ed.ano),
  ]);
  return ok();
}

export async function refazerSorteio(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const res = await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sorteio WHERE ano = ? AND ${faseAtual(ed.ano)} = 'troca'`).bind(ed.ano),
    c.env.DB.prepare("UPDATE edicoes SET fase = 'lobby', versao = versao + 1 WHERE ano = ? AND fase = 'troca'").bind(ed.ano),
  ]);
  exigirMudou(res[1], 'Só dá para refazer o sorteio antes da votação abrir.');
  return ok();
}

export async function abrirVotacao(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const ativas = await c.env.DB.prepare('SELECT count(*) AS n FROM categorias WHERE ativa = 1').first<{ n: number }>();
  if (!ativas?.n) throw erro(400, 'sem-categorias', 'Não tem nenhuma categoria ativa.');
  const naTroca = `${faseAtual(ed.ano)} = 'troca'`;
  const res = await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM edicao_categorias WHERE ano = ? AND ${naTroca}`).bind(ed.ano),
    c.env.DB.prepare(
      `INSERT INTO edicao_categorias (ano, categoria_id, nome, descricao, ordem)
       SELECT ?, id, nome, descricao, ordem FROM categorias WHERE ativa = 1 AND ${naTroca}`,
    ).bind(ed.ano),
    c.env.DB.prepare("UPDATE edicoes SET fase = 'votacao', versao = versao + 1 WHERE ano = ? AND fase = 'troca'").bind(ed.ano),
  ]);
  exigirMudou(res[2], 'A votação só abre depois do sorteio.');
  return ok();
}

/** Fecha, apura e apaga os votos individuais. */
export async function fecharVotacao(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const r = await c.env.DB.prepare(
    "UPDATE edicoes SET fase = 'revelacao', categorias_reveladas = 0, versao = versao + 1 WHERE ano = ? AND fase = 'votacao'",
  )
    .bind(ed.ano)
    .run();
  exigirMudou(r, 'A votação não está aberta.');

  const [catR, votosR] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT categoria_id FROM edicao_categorias WHERE ano = ? ORDER BY ordem').bind(ed.ano),
    // Só valem as cédulas enviadas.
    c.env.DB.prepare(
      `SELECT v.categoria_id AS categoria, v.indicado_id AS indicado, v.justificativa FROM votos v
       JOIN cedulas c ON c.ano = v.ano AND c.eleitor_id = v.eleitor_id WHERE v.ano = ?`,
    ).bind(ed.ano),
  ]);
  const categorias = (catR.results as { categoria_id: string }[]).map((k) => k.categoria_id);
  const apuracao = apurar(categorias, votosR.results as unknown as VotoApurado[]);

  const stmts: D1PreparedStatement[] = [];
  for (const cat of apuracao) {
    for (const v of cat.vencedores) {
      stmts.push(
        c.env.DB.prepare("INSERT OR IGNORE INTO resultados (ano, categoria_id, vencedor_id, origem) VALUES (?, ?, ?, 'app')").bind(ed.ano, cat.categoria, v),
      );
    }
    embaralhar(cat.justificativas).forEach((j, i) =>
      stmts.push(
        c.env.DB.prepare('INSERT INTO justificativas (ano, categoria_id, indicado_id, texto, posicao) VALUES (?, ?, ?, ?, ?)').bind(
          ed.ano,
          cat.categoria,
          j.indicado,
          j.texto,
          i,
        ),
      ),
    );
  }
  stmts.push(c.env.DB.prepare('DELETE FROM votos WHERE ano = ?').bind(ed.ano), tocar(c.env, ed.ano));
  await c.env.DB.batch(stmts);
  return ok();
}

export async function revelarProxima(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const r = await c.env.DB.prepare(
    `UPDATE edicoes SET categorias_reveladas = categorias_reveladas + 1, versao = versao + 1
     WHERE ano = ?1 AND fase = 'revelacao' AND categorias_reveladas < (SELECT count(*) FROM edicao_categorias WHERE ano = ?1)`,
  )
    .bind(ed.ano)
    .run();
  exigirMudou(r, 'Não tem mais nada para revelar.');
  return ok();
}

export async function encerrar(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const r = await c.env.DB.prepare(
    `UPDATE edicoes SET fase = 'encerrada', categorias_reveladas = (SELECT count(*) FROM edicao_categorias WHERE ano = ?1),
     versao = versao + 1 WHERE ano = ?1 AND fase = 'revelacao'`,
  )
    .bind(ed.ano)
    .run();
  exigirMudou(r, 'A edição só encerra depois da revelação.');
  return ok();
}

/** Solta o perfil do aparelho (troca de celular, Safari limpo). */
export async function liberar(c: Ctx) {
  const ed = await edicaoAtual(c.env);
  const { participante } = await lerCorpo<{ participante?: string }>(c.req);
  const r = await c.env.DB.prepare('DELETE FROM lobby WHERE ano = ? AND participante_id = ?').bind(ed.ano, participante ?? '').run();
  if (r.meta.changes) await tocar(c.env, ed.ano).run();
  return ok();
}

// ---------- Gestão ----------

export async function gestao(c: Ctx) {
  const [pR, cR, eR, epR] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, nome, admin, ativo, EXISTS (SELECT 1 FROM fotos f WHERE f.participante_id = p.id) AS tem_foto
       FROM participantes p ORDER BY ordem, id`,
    ),
    c.env.DB.prepare('SELECT id, nome, descricao, ordem, ativa FROM categorias ORDER BY ordem, id'),
    c.env.DB.prepare('SELECT ano, data, local, fotos_url, fase, atual FROM edicoes ORDER BY ano DESC'),
    c.env.DB.prepare('SELECT ano, participante_id FROM edicao_participantes'),
  ]);
  const ep = epR.results as { ano: number; participante_id: string }[];
  const resposta: Gestao = {
    participantes: (pR.results as { id: string; nome: string; admin: number; ativo: number; tem_foto: number }[]).map((p) => ({
      id: p.id,
      nome: p.nome,
      admin: !!p.admin,
      ativo: !!p.ativo,
      temFoto: !!p.tem_foto,
    })),
    categorias: (cR.results as { id: string; nome: string; descricao: string; ordem: number; ativa: number }[]).map((k) => ({
      ...k,
      ativa: !!k.ativa,
    })),
    edicoes: (
      eR.results as { ano: number; data: string | null; local: string | null; fotos_url: string | null; fase: Gestao['edicoes'][number]['fase']; atual: number }[]
    ).map(({ fotos_url, ...e }) => ({
      ...e,
      fotosUrl: fotos_url,
      atual: !!e.atual,
      participantes: ep.filter((x) => x.ano === e.ano).map((x) => x.participante_id),
    })),
  };
  return json(resposta);
}

function validarData(data: unknown): string | null {
  if (data === null || data === undefined || data === '') return null;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erro(400, 'data', 'Data inválida.');
  return data;
}

function validarLocal(local: unknown): string | null {
  if (local === null || local === undefined) return null;
  if (typeof local !== 'string' || local.trim().length > 80) throw erro(400, 'local', 'Local muito longo.');
  return local.trim() || null;
}

/** Link da pasta de fotos do ano (Google Drive ou parecido): só https. */
function validarFotosUrl(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || valor.trim().length > 400) throw erro(400, 'fotos-url', 'Link das fotos muito longo.');
  const texto = valor.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw erro(400, 'fotos-url', 'Link das fotos inválido.');
  }
  if (url.protocol !== 'https:') throw erro(400, 'fotos-url', 'O link das fotos precisa começar com https://');
  return url.toString();
}

/** Cria a edição do ano (vira a atual) ou edita data, local e quem participa da atual. */
export async function salvarEdicao(c: Ctx) {
  const corpo = await lerCorpo<{ ano?: number; data?: string | null; local?: string | null; fotosUrl?: string | null; participantes?: string[] }>(c.req);
  const ano = Number(corpo.ano);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw erro(400, 'ano', 'Ano inválido.');
  const data = validarData(corpo.data);
  const local = validarLocal(corpo.local);
  const fotosUrl = validarFotosUrl(corpo.fotosUrl);
  const atual = await edicaoAtual(c.env).catch(() => null);

  let lista = corpo.participantes;
  if (lista !== undefined) {
    if (!Array.isArray(lista) || lista.some((id) => typeof id !== 'string')) throw erro(400, 'participantes', 'Lista inválida.');
    const { results } = await c.env.DB.prepare('SELECT id FROM participantes WHERE ativo = 1').all<{ id: string }>();
    const validos = new Set(results.map((r) => r.id));
    lista = [...new Set(lista)].filter((id) => validos.has(id));
    if (lista.length < 2) throw erro(400, 'participantes', 'A edição precisa de pelo menos 2 participantes.');
  }

  if (!atual || atual.ano !== ano) {
    if (atual && atual.fase !== 'preparacao' && atual.fase !== 'encerrada') {
      throw erro(409, 'edicao-em-andamento', `A edição ${atual.ano} ainda está em andamento.`);
    }
    const existe = await c.env.DB.prepare('SELECT ano FROM edicoes WHERE ano = ?').bind(ano).first();
    if (existe) throw erro(409, 'edicao-existe', `Já existe uma edição de ${ano} no histórico.`);
    const ids = lista ?? (await c.env.DB.prepare('SELECT id FROM participantes WHERE ativo = 1').all<{ id: string }>()).results.map((r) => r.id);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE edicoes SET atual = 0'),
      c.env.DB.prepare('INSERT INTO edicoes (ano, data, local, atual) VALUES (?, ?, ?, 1)').bind(ano, data, local),
      ...ids.map((id) => c.env.DB.prepare('INSERT INTO edicao_participantes (ano, participante_id) VALUES (?, ?)').bind(ano, id)),
    ]);
    return ok();
  }

  const stmts: D1PreparedStatement[] = [c.env.DB.prepare('UPDATE edicoes SET data = ?, local = ? WHERE ano = ?').bind(data, local, ano)];
  if (corpo.fotosUrl !== undefined) stmts.push(c.env.DB.prepare('UPDATE edicoes SET fotos_url = ? WHERE ano = ?').bind(fotosUrl, ano));
  if (lista) {
    if (atual.fase !== 'preparacao' && atual.fase !== 'lobby') {
      throw erro(409, 'fase', 'Quem participa só muda antes do sorteio.');
    }
    const marcadores = lista.map(() => '?').join(',');
    stmts.push(
      c.env.DB.prepare(`DELETE FROM edicao_participantes WHERE ano = ? AND participante_id NOT IN (${marcadores})`).bind(ano, ...lista),
      c.env.DB.prepare(`DELETE FROM lobby WHERE ano = ? AND participante_id NOT IN (${marcadores})`).bind(ano, ...lista),
      ...lista.map((id) => c.env.DB.prepare('INSERT OR IGNORE INTO edicao_participantes (ano, participante_id) VALUES (?, ?)').bind(ano, id)),
    );
  }
  stmts.push(tocar(c.env, ano));
  await c.env.DB.batch(stmts);
  return ok();
}

export async function salvarParticipante(c: Ctx) {
  const [id] = c.params;
  const { nome, ativo } = await lerCorpo<{ nome?: string; ativo?: boolean }>(c.req);
  const limpo = typeof nome === 'string' ? nome.trim() : '';
  if (!limpo || limpo.length > 30) throw erro(400, 'nome', 'Nome precisa ter de 1 a 30 caracteres.');
  const existente = await c.env.DB.prepare('SELECT admin FROM participantes WHERE id = ?').bind(id).first<{ admin: number }>();
  if (existente?.admin && ativo === false) throw erro(400, 'admin', 'O admin não pode ser desativado.');
  const ed = await edicaoAtual(c.env).catch(() => null);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO participantes (id, nome, ativo, ordem) VALUES (?1, ?2, ?3, (SELECT coalesce(max(ordem), 0) + 1 FROM participantes))
       ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, ativo = excluded.ativo`,
    ).bind(id, limpo, ativo === false ? 0 : 1),
    ...(ed ? [tocar(c.env, ed.ano)] : []),
  ]);
  return ok();
}

const MIMES = new Set(['image/webp', 'image/jpeg', 'image/png']);

export async function salvarFoto(c: Ctx) {
  const [id, tam] = c.params;
  const mime = (c.req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!MIMES.has(mime)) throw erro(415, 'formato', 'Envie WebP, JPEG ou PNG.');
  const bytes = await c.req.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 300_000) throw erro(413, 'tamanho', 'A foto precisa ter até 300 KB.');
  const existe = await c.env.DB.prepare('SELECT 1 FROM participantes WHERE id = ?').bind(id).first();
  if (!existe) throw erro(404, 'participante', 'Participante não encontrado.');
  const ed = await edicaoAtual(c.env).catch(() => null);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO fotos (participante_id, tamanho, mime, bytes, versao) VALUES (?1, ?2, ?3, ?4,
         (SELECT coalesce(max(versao), 0) + 1 FROM fotos WHERE participante_id = ?1))
       ON CONFLICT (participante_id, tamanho) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, versao = excluded.versao`,
    ).bind(id, Number(tam), mime, bytes),
    ...(ed ? [tocar(c.env, ed.ano)] : []),
  ]);
  return ok();
}

export async function salvarCategorias(c: Ctx) {
  const { categorias } = await lerCorpo<{ categorias?: { id?: string; nome?: string; descricao?: string; ativa?: boolean }[] }>(c.req);
  if (!Array.isArray(categorias) || !categorias.length) throw erro(400, 'categorias', 'Lista de categorias vazia.');
  const usados = new Set<string>();
  const linhas = categorias.map((k, i) => {
    const nome = (k.nome ?? '').trim();
    if (!nome || nome.length > 50) throw erro(400, 'nome', 'Cada categoria precisa de um nome (até 50 caracteres).');
    let id = k.id && /^[a-z0-9-]{1,40}$/.test(k.id) ? k.id : slug(nome);
    while (usados.has(id)) id = `${id}-${i}`;
    usados.add(id);
    return { id, nome, descricao: (k.descricao ?? '').trim().slice(0, 120), ordem: i + 1, ativa: k.ativa === false ? 0 : 1 };
  });
  const marcadores = linhas.map(() => '?').join(',');
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE categorias SET ativa = 0 WHERE id NOT IN (${marcadores})`).bind(...linhas.map((l) => l.id)),
    ...linhas.map((l) =>
      c.env.DB.prepare(
        `INSERT INTO categorias (id, nome, descricao, ordem, ativa) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, descricao = excluded.descricao, ordem = excluded.ordem, ativa = excluded.ativa`,
      ).bind(l.id, l.nome, l.descricao, l.ordem, l.ativa),
    ),
  ]);
  return ok();
}

/**
 * Cadastra um ano no Hall da Fama ou corrige um ano que já passou.
 * - `categorias: []` = ano sem premiação (a sala de troféus fica só com as sombras dos pins).
 * - Sem `categorias`, mexe só em data, local e link das fotos: resultados e justificativas ficam como estão.
 */
export async function salvarHall(c: Ctx) {
  const ano = Number(c.params[0]);
  if (ano < 2000 || ano > 2100) throw erro(400, 'ano', 'Ano inválido.');
  const corpo = await lerCorpo<{
    data?: string | null;
    local?: string | null;
    fotosUrl?: string | null;
    categorias?: { nome?: string; vencedores?: string[] }[];
  }>(c.req);
  const atual = await edicaoAtual(c.env).catch(() => null);
  if (atual?.ano === ano && atual.fase !== 'encerrada') throw erro(409, 'fase', 'Essa edição ainda está acontecendo.');
  if (corpo.categorias !== undefined && !Array.isArray(corpo.categorias)) throw erro(400, 'categorias', 'Lista de categorias inválida.');

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO edicoes (ano, data, local, fase, atual) VALUES (?, ?, ?, 'encerrada', 0)
       ON CONFLICT (ano) DO UPDATE SET data = excluded.data, local = excluded.local`,
    ).bind(ano, validarData(corpo.data), validarLocal(corpo.local)),
  ];
  if (corpo.fotosUrl !== undefined) {
    stmts.push(c.env.DB.prepare('UPDATE edicoes SET fotos_url = ? WHERE ano = ?').bind(validarFotosUrl(corpo.fotosUrl), ano));
  }

  if (corpo.categorias) {
    const [pessoasR, categoriasR] = await c.env.DB.batch([
      c.env.DB.prepare('SELECT id FROM participantes'),
      c.env.DB.prepare('SELECT id, nome FROM categorias'),
    ]);
    const pessoas = new Set((pessoasR.results as { id: string }[]).map((r) => r.id));
    // Categoria com o mesmo nome de uma que já existe usa o mesmo id (e o mesmo pin).
    const idPorNome = new Map((categoriasR.results as { id: string; nome: string }[]).map((k) => [slug(k.nome), k.id]));
    const usados = new Set<string>();
    const categorias = corpo.categorias.map((k, i) => {
      const nome = (k.nome ?? '').trim();
      if (!nome || nome.length > 50) throw erro(400, 'nome', 'Cada categoria precisa de um nome.');
      let id = idPorNome.get(slug(nome)) ?? slug(nome);
      while (usados.has(id)) id = `${id}-${i}`;
      usados.add(id);
      const vencedores = [...new Set(k.vencedores ?? [])].filter((v) => pessoas.has(v));
      return { id, nome, ordem: i + 1, vencedores };
    });
    stmts.push(
      c.env.DB.prepare('DELETE FROM justificativas WHERE ano = ?').bind(ano),
      c.env.DB.prepare('DELETE FROM resultados WHERE ano = ?').bind(ano),
      c.env.DB.prepare('DELETE FROM edicao_categorias WHERE ano = ?').bind(ano),
      ...categorias.flatMap((k) => [
        c.env.DB.prepare('INSERT INTO edicao_categorias (ano, categoria_id, nome, ordem) VALUES (?, ?, ?, ?)').bind(ano, k.id, k.nome, k.ordem),
        ...k.vencedores.map((v) =>
          c.env.DB.prepare("INSERT INTO resultados (ano, categoria_id, vencedor_id, origem) VALUES (?, ?, ?, 'manual')").bind(ano, k.id, v),
        ),
      ]),
    );
  }
  await c.env.DB.batch(stmts);
  return ok();
}

export async function apagarHall(c: Ctx) {
  const ano = Number(c.params[0]);
  const atual = await edicaoAtual(c.env).catch(() => null);
  if (atual?.ano === ano) throw erro(409, 'edicao-atual', 'Não dá para apagar a edição atual.');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM justificativas WHERE ano = ?').bind(ano),
    c.env.DB.prepare('DELETE FROM resultados WHERE ano = ?').bind(ano),
    c.env.DB.prepare('DELETE FROM edicao_categorias WHERE ano = ?').bind(ano),
    c.env.DB.prepare('DELETE FROM edicoes WHERE ano = ? AND atual = 0').bind(ano),
  ]);
  return ok();
}
