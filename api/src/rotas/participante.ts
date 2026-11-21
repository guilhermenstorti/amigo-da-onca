import type { MeuSorteio, MeusVotos } from '../contrato';
import { exigirParticipante, exigirVinculo, nomeDoAdmin, type Ctx } from '../contexto';
import { edicaoAtual, exigirFase, idsDaEdicao, tocar } from '../dados';
import { agora, erro, json, lerCorpo, ok } from '../http';

/** Entra no lobby e prende o perfil a este aparelho durante a edição. */
export async function entrarLobby(c: Ctx) {
  const sessao = exigirParticipante(c);
  const ed = await edicaoAtual(c.env);
  const ids = await idsDaEdicao(c.env, ed.ano);
  if (!ids.includes(sessao.p)) throw erro(403, 'fora-da-edicao', 'Você não está na lista deste ano. Fala com o admin.');

  // Depois do sorteio só dá para (re)entrar se o admin liberou o perfil (troca de celular).
  exigirFase(ed, 'lobby', 'troca', 'votacao', 'revelacao');
  const r = await c.env.DB.prepare(
    'INSERT INTO lobby (ano, participante_id, aparelho_id, entrou_em) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
  )
    .bind(ed.ano, sessao.p, sessao.a, Date.now())
    .run();
  if (r.meta.changes === 1) {
    await tocar(c.env, ed.ano).run();
    return ok();
  }
  const { results } = await c.env.DB.prepare(
    `SELECT l.participante_id, l.aparelho_id, p.nome FROM lobby l JOIN participantes p ON p.id = l.participante_id
     WHERE l.ano = ? AND (l.participante_id = ? OR l.aparelho_id = ?)`,
  )
    .bind(ed.ano, sessao.p, sessao.a)
    .all<{ participante_id: string; aparelho_id: string; nome: string }>();
  if (results.some((l) => l.participante_id === sessao.p && l.aparelho_id === sessao.a)) return ok();
  const admin = await nomeDoAdmin(c);
  const outro = results.find((l) => l.aparelho_id === sessao.a);
  if (outro) throw erro(409, 'aparelho-em-uso', `Este celular já está no lobby como ${outro.nome}. Peça pro ${admin} liberar.`);
  throw erro(409, 'perfil-em-uso', `Seu perfil já está no lobby em outro celular. Peça pro ${admin} liberar.`);
}

export async function meuSorteio(c: Ctx) {
  const { sessao, ed } = await exigirVinculo(c);
  exigirFase(ed, 'troca', 'votacao', 'revelacao', 'encerrada');
  const [parR, nomesR] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT s.recebedor_id AS id, p.nome, (SELECT sorteado_em FROM edicoes WHERE ano = s.ano) AS sorteado_em
       FROM sorteio s JOIN participantes p ON p.id = s.recebedor_id
       WHERE s.ano = ? AND s.doador_id = ?`,
    ).bind(ed.ano, sessao.p),
    c.env.DB.prepare(
      `SELECT p.nome FROM edicao_participantes ep JOIN participantes p ON p.id = ep.participante_id
       WHERE ep.ano = ? AND ep.participante_id <> ? ORDER BY p.ordem`,
    ).bind(ed.ano, sessao.p),
  ]);
  const par = parR.results[0] as { id: string; nome: string; sorteado_em: number | null } | undefined;
  if (!par) throw erro(404, 'sem-par', 'Você não participou deste sorteio.');
  const resposta: MeuSorteio = {
    recebedor: { id: par.id, nome: par.nome },
    outros: (nomesR.results as { nome: string }[]).map((n) => n.nome),
    sorteadoEm: par.sorteado_em ?? 0,
  };
  return json(resposta);
}

export async function meusVotos(c: Ctx) {
  const { sessao, ed } = await exigirVinculo(c);
  const [votosR, cedulaR] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT categoria_id, indicado_id, justificativa FROM votos WHERE ano = ? AND eleitor_id = ?').bind(ed.ano, sessao.p),
    c.env.DB.prepare('SELECT 1 FROM cedulas WHERE ano = ? AND eleitor_id = ?').bind(ed.ano, sessao.p),
  ]);
  const resposta: MeusVotos = { votos: {}, enviada: cedulaR.results.length > 0 };
  for (const v of votosR.results as { categoria_id: string; indicado_id: string; justificativa: string | null }[]) {
    resposta.votos[v.categoria_id] = { indicado: v.indicado_id, justificativa: v.justificativa };
  }
  return json(resposta);
}

/** Salva (ou troca) o voto numa categoria. Pode votar em si mesmo. */
export async function votar(c: Ctx) {
  const { sessao, ed } = await exigirVinculo(c);
  exigirFase(ed, 'votacao');
  const [categoria] = c.params;
  const { indicado, justificativa } = await lerCorpo<{ indicado?: string; justificativa?: string | null }>(c.req);
  const texto = typeof justificativa === 'string' ? justificativa.trim().replace(/\s+/g, ' ') : '';
  if (texto.length > 140) throw erro(400, 'justificativa', 'A justificativa pode ter até 140 caracteres.');

  const [catR, indR] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT 1 FROM edicao_categorias WHERE ano = ? AND categoria_id = ?').bind(ed.ano, categoria),
    c.env.DB.prepare('SELECT 1 FROM edicao_participantes WHERE ano = ? AND participante_id = ?').bind(ed.ano, indicado ?? ''),
  ]);
  if (!catR.results.length) throw erro(404, 'categoria', 'Categoria não encontrada.');
  if (!indR.results.length) throw erro(400, 'indicado', 'Essa pessoa não está na edição.');

  // Condicional na fase: um voto que chega depois do fechamento não entra.
  const r = await c.env.DB.prepare(
    `INSERT INTO votos (ano, categoria_id, eleitor_id, indicado_id, justificativa)
     SELECT ?1, ?2, ?3, ?4, ?5 WHERE (SELECT fase FROM edicoes WHERE ano = ?1) = 'votacao'
     ON CONFLICT (ano, categoria_id, eleitor_id) DO UPDATE SET indicado_id = excluded.indicado_id, justificativa = excluded.justificativa`,
  )
    .bind(ed.ano, categoria, sessao.p, indicado, texto || null)
    .run();
  if (r.meta.changes === 0) throw erro(409, 'fase', 'A votação já fechou.');
  return ok();
}

export async function enviarVotos(c: Ctx) {
  const { sessao, ed } = await exigirVinculo(c);
  exigirFase(ed, 'votacao');
  const faltando = await c.env.DB.prepare(
    `SELECT count(*) AS n FROM edicao_categorias ec WHERE ec.ano = ?1
     AND NOT EXISTS (SELECT 1 FROM votos v WHERE v.ano = ?1 AND v.categoria_id = ec.categoria_id AND v.eleitor_id = ?2)`,
  )
    .bind(ed.ano, sessao.p)
    .first<{ n: number }>();
  if (faltando && faltando.n > 0) throw erro(400, 'faltam-votos', 'Falta votar em alguma categoria.');
  const r = await c.env.DB.prepare(
    `INSERT INTO cedulas (ano, eleitor_id, enviada_em)
     SELECT ?1, ?2, ?3 WHERE (SELECT fase FROM edicoes WHERE ano = ?1) = 'votacao'
     ON CONFLICT DO NOTHING`,
  )
    .bind(ed.ano, sessao.p, agora())
    .run();
  if (r.meta.changes === 1) await tocar(c.env, ed.ano).run();
  return ok();
}
