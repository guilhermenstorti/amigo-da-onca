// Simula a noite inteira contra o Worker rodando de verdade (wrangler dev + D1 local).
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Estado, MeuSorteio, Revelacao, AnoHall } from '../src/contrato';

const PORTA = 8799;
const BASE = `http://127.0.0.1:${PORTA}`;
const PERSIST = '.tmp/d1-teste';
const SENHA = 'senha-do-teste';
const turma = ['gui', 'maria', 'maju', 'ju', 'isa', 'gomi', 'hugo', 'tavinho', 'sola'];

let servidor: ChildProcess;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chamar<T = any>(token: string | null, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, dados: (texto ? JSON.parse(texto) : null) as T, texto };
}

function d1(sql: string): any[] {
  const saida = execSync(`npx wrangler d1 execute DB --local --persist-to ${PERSIST} --json --command "${sql}"`, {
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  return JSON.parse(saida)[0].results;
}

beforeAll(async () => {
  rmSync(PERSIST, { recursive: true, force: true });
  execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${PERSIST}`, { stdio: 'pipe', env: { ...process.env, CI: '1' } });
  servidor = spawn(
    `npx wrangler dev --port ${PORTA} --ip 127.0.0.1 --persist-to ${PERSIST} --env-file test/teste.env --show-interactive-dev-session=false`,
    { shell: true, detached: process.platform !== 'win32', env: { ...process.env, CI: '1' } },
  );
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`${BASE}/estado`)).status === 401) return;
    } catch {}
    await esperar(500);
  }
  throw new Error('wrangler dev não subiu');
});

afterAll(() => {
  if (!servidor?.pid) return;
  if (process.platform === 'win32') execSync(`taskkill /pid ${servidor.pid} /T /F`, { stdio: 'ignore' });
  else process.kill(-servidor.pid, 'SIGTERM');
});

describe('a noite do amigo da onça', () => {
  const tokens: Record<string, string> = {};

  it('sem palavra-chave nada funciona', async () => {
    expect((await chamar(null, 'GET', '/estado')).status).toBe(401);
    expect((await chamar(null, 'GET', '/hall')).status).toBe(401);
    expect((await chamar(null, 'POST', '/acesso', { palavra: 'errada' })).status).toBe(401);
  });

  it('palavra-chave ignora maiúscula e espaços; cada um escolhe o perfil', async () => {
    for (const id of turma) {
      const acesso = await chamar(null, 'POST', '/acesso', { palavra: id === 'gui' ? ' pintada ' : 'PINTADA' });
      expect(acesso.status).toBe(200);
      const t = acesso.dados.token as string;
      if (id === 'gui') {
        expect((await chamar(t, 'POST', '/sessao', { participante: 'gui' })).status).toBe(401);
        expect((await chamar(t, 'POST', '/sessao', { participante: 'gui', senha: 'chute' })).status).toBe(401);
      }
      const sessao = await chamar(t, 'POST', '/sessao', { participante: id, senha: id === 'gui' ? SENHA : undefined });
      expect(sessao.status).toBe(200);
      tokens[id] = sessao.dados.token;
    }
    const e = await chamar<Estado>(tokens.gui, 'GET', '/estado');
    expect(e.dados.edicao.fase).toBe('preparacao');
    expect(e.dados.eu).toMatchObject({ id: 'gui', admin: true, vinculo: null });
    expect(e.dados.pessoas.map((p) => p.id)).toEqual(turma);
    const outro = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    expect(outro.dados.eu?.admin).toBe(false);
    expect(outro.dados.admin).toBeUndefined();
  });

  it('Hall antes da festa: o ano atual só com as sombras dos pins', async () => {
    const { dados: hall } = await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall');
    expect(hall).toHaveLength(1);
    expect(hall[0]).toMatchObject({ ano: 2026, atual: true, premiacao: 'em-breve', fotosUrl: null });
    expect(hall[0].pins.map((p) => p.id)).toEqual(['mais-util', 'mais-inutil', 'revelacao', 'mais-criativo', 'melhor-embalagem', 'presente-do-ano']);
    expect(hall[0].pins.every((p) => p.vencedores === null)).toBe(true);
  });

  it('anos sem premiação entram no Hall com o link das fotos', async () => {
    const link = 'https://drive.google.com/drive/folders/pasta-de-teste';
    expect((await chamar(tokens.ju, 'PUT', '/admin/hall/2025', { categorias: [], fotosUrl: link })).status).toBe(403);
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2025', { categorias: [], fotosUrl: 'http://inseguro.com' })).status).toBe(400);
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2025', { categorias: [], fotosUrl: 'não é link' })).status).toBe(400);
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2025', { categorias: [], fotosUrl: link })).status).toBe(200);
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2024', { categorias: [], fotosUrl: link })).status).toBe(200);
    // O ano atual só passa pelo Hall depois de encerrado.
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2026', { categorias: [] })).status).toBe(409);

    const { dados: hall } = await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall');
    expect(hall.map((a) => a.ano)).toEqual([2026, 2025, 2024]);
    expect(hall[1]).toMatchObject({ atual: false, premiacao: 'sem', fotosUrl: link });
    expect(hall[1].pins).toHaveLength(6);
    expect(hall[1].pins.every((p) => p.vencedores === null)).toBe(true);

    // Categoria com o nome de uma que já existe usa o mesmo id (e o mesmo pin).
    expect(
      (await chamar(tokens.gui, 'PUT', '/admin/hall/2024', { fotosUrl: link, categorias: [{ nome: 'Presente do ano', vencedores: ['isa'] }] })).status,
    ).toBe(200);
    const ano2024 = (await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall')).dados.find((a) => a.ano === 2024)!;
    expect(ano2024).toMatchObject({ premiacao: 'completa', pins: [{ id: 'presente-do-ano', vencedores: [{ id: 'isa', nome: 'Isa' }] }] });

    // Apagar o ano apaga a sala de troféus junto.
    expect((await chamar(tokens.gui, 'DELETE', '/admin/hall/2024')).status).toBe(200);
    expect((await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall')).dados.map((a) => a.ano)).toEqual([2026, 2025]);
    expect(d1('SELECT count(*) AS n FROM resultados WHERE ano = 2024')[0].n).toBe(0);
  });

  it('estado sem mudança responde 204', async () => {
    const e = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    expect((await chamar(tokens.ju, 'GET', `/estado?v=${e.dados.versao}`)).status).toBe(204);
  });

  it('só o admin controla a noite', async () => {
    expect((await chamar(tokens.ju, 'POST', '/admin/lobby/abrir')).status).toBe(403);
    expect((await chamar(tokens.ju, 'POST', '/lobby/entrar')).status).toBe(409);
    expect((await chamar(tokens.gui, 'POST', '/admin/lobby/abrir')).status).toBe(200);
  });

  it('lobby: perfil preso ao aparelho, sorteio só com todos', async () => {
    for (const id of turma.filter((x) => x !== 'sola')) expect((await chamar(tokens[id], 'POST', '/lobby/entrar')).status).toBe(200);
    expect((await chamar(tokens.maria, 'POST', '/lobby/entrar')).status).toBe(200); // idempotente

    // Outro celular tentando usar o perfil da Maria
    const intruso = (await chamar(null, 'POST', '/acesso', { palavra: 'pintada' })).dados.token;
    expect((await chamar(intruso, 'POST', '/sessao', { participante: 'maria' })).dados.erro).toBe('perfil-em-uso');
    // O celular da Maria tentando virar a Sola
    expect((await chamar(tokens.maria, 'POST', '/sessao', { participante: 'sola' })).dados.erro).toBe('aparelho-em-uso');

    const incompleto = await chamar(tokens.gui, 'POST', '/admin/sortear');
    expect(incompleto.status).toBe(409);
    expect((await chamar<Estado>(tokens.gui, 'GET', '/estado')).dados.admin?.faltamNoLobby).toEqual(['sola']);

    expect((await chamar(tokens.sola, 'POST', '/lobby/entrar')).status).toBe(200);
    const e = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    expect(e.dados.lobby).toMatchObject({ total: 9, completo: true });
    expect(e.dados.lobby.presentes.at(-1)).toBe('sola');
  });

  it('sorteio 1:1 e cada um só vê o seu', async () => {
    expect((await chamar(tokens.ju, 'POST', '/admin/sortear')).status).toBe(403);
    expect((await chamar(tokens.gui, 'POST', '/admin/sortear')).status).toBe(200);
    expect((await chamar(tokens.gui, 'POST', '/admin/sortear')).dados.jaSorteado).toBe(true);

    const recebedores: string[] = [];
    for (const id of turma) {
      const r = await chamar<MeuSorteio>(tokens[id], 'GET', '/sorteio/meu');
      expect(r.status).toBe(200);
      expect(Object.keys(r.dados).sort()).toEqual(['outros', 'recebedor', 'sorteadoEm']);
      expect(r.dados.recebedor.id).not.toBe(id);
      expect(r.dados.outros).toHaveLength(8);
      recebedores.push(r.dados.recebedor.id);
    }
    expect(new Set(recebedores).size).toBe(9);
    // Nenhuma resposta de estado carrega os pares
    expect((await chamar(tokens.gui, 'GET', '/estado')).texto).not.toContain('recebedor');
  });

  it('liberar perfil permite trocar de celular', async () => {
    expect((await chamar(tokens.gui, 'POST', '/admin/liberar', { participante: 'isa' })).status).toBe(200);
    expect((await chamar(tokens.isa, 'GET', '/sorteio/meu')).dados.erro).toBe('fora-do-lobby');
    const novo = (await chamar(null, 'POST', '/acesso', { palavra: 'pintada' })).dados.token;
    tokens.isa = (await chamar(novo, 'POST', '/sessao', { participante: 'isa' })).dados.token;
    expect((await chamar(tokens.isa, 'POST', '/lobby/entrar')).status).toBe(200);
    expect((await chamar(tokens.isa, 'GET', '/sorteio/meu')).status).toBe(200);
  });

  it('votação: anônima, com justificativa, pode votar em si mesmo', async () => {
    expect((await chamar(tokens.ju, 'PUT', '/votos/mais-util', { indicado: 'hugo' })).status).toBe(409);
    expect((await chamar(tokens.gui, 'POST', '/admin/votacao/abrir')).status).toBe(200);
    const { dados: e } = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    const categorias = e.votacao.categorias.map((c) => c.id);
    expect(categorias).toHaveLength(6);

    for (const [i, eleitor] of turma.entries()) {
      for (const [k, cat] of categorias.entries()) {
        const indicado = eleitor === 'maria' && k === 0 ? 'maria' : turma[(k + 1) % 9];
        const r = await chamar(tokens[eleitor], 'PUT', `/votos/${cat}`, { indicado, justificativa: i % 2 ? `j-${eleitor}-${k}` : '' });
        expect(r.status).toBe(200);
      }
      // A Sola salva mas não envia: não conta.
      if (eleitor !== 'sola') expect((await chamar(tokens[eleitor], 'POST', '/votos/enviar')).status).toBe(200);
    }
    expect((await chamar(tokens.ju, 'PUT', '/votos/mais-util', { indicado: 'hugo', justificativa: 'x'.repeat(141) })).status).toBe(400);

    const meus = await chamar(tokens.maria, 'GET', '/votos');
    expect(meus.dados.votos['mais-util'].indicado).toBe('maria');
    const adm = await chamar<Estado>(tokens.gui, 'GET', '/estado');
    expect(adm.dados.votacao).toMatchObject({ enviaram: 8, total: 9 });
    expect(adm.dados.admin?.faltamVotar).toEqual(['sola']);
    expect(adm.texto).not.toMatch(/eleitor|indicado/);
  });

  it('fechar apura e apaga os votos individuais', async () => {
    expect((await chamar(tokens.gui, 'POST', '/admin/votacao/fechar')).status).toBe(200);
    expect((await chamar(tokens.ju, 'PUT', '/votos/mais-util', { indicado: 'hugo' })).status).toBe(409);
    expect(d1('SELECT count(*) AS n FROM votos')[0].n).toBe(0);
    expect(JSON.stringify(d1('SELECT * FROM justificativas'))).not.toMatch(/eleitor/);

    const antes = await chamar<Revelacao>(tokens.ju, 'GET', '/revelacao');
    expect(antes.dados).toMatchObject({ disponivel: true, reveladas: 0, total: 6 });
    expect(antes.texto).not.toContain('vencedores');
  });

  it('revelação categoria por categoria e Hall da Fama', async () => {
    const pinsDe2026 = async () => (await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall')).dados.find((a) => a.ano === 2026)!;
    // Votação apurada, nada revelado: o Hall não entrega nenhum vencedor.
    let ano = await pinsDe2026();
    expect(ano.premiacao).toBe('revelando');
    expect(ano.pins.every((p) => p.vencedores === null)).toBe(true);

    // Cada categoria revelada vai direto para a sala de troféus; as outras continuam em segredo.
    expect((await chamar(tokens.gui, 'POST', '/admin/revelar')).status).toBe(200);
    ano = await pinsDe2026();
    expect(ano.pins[0].vencedores?.map((v) => v.id)).toEqual(['maria']);
    expect(ano.pins.slice(1).every((p) => p.vencedores === null)).toBe(true);

    for (let k = 1; k < 6; k++) expect((await chamar(tokens.gui, 'POST', '/admin/revelar')).status).toBe(200);
    expect((await chamar(tokens.gui, 'POST', '/admin/revelar')).status).toBe(409);
    const { dados: r } = await chamar<Revelacao>(tokens.ju, 'GET', '/revelacao');
    r.categorias.forEach((cat, k) => {
      expect(cat.revelada).toBe(true);
      expect(cat.vencedores?.map((v) => v.id)).toEqual([turma[(k + 1) % 9]]);
      // Justificativas só dos votos ímpares enviados (a Sola não enviou), sem autoria.
      expect(cat.justificativas?.every((j) => /^j-/.test(j))).toBe(true);
    });
    ano = await pinsDe2026();
    expect(ano.pins.map((p) => p.vencedores?.map((v) => v.id))).toEqual(r.categorias.map((cat) => cat.vencedores?.map((v) => v.id)));

    expect((await chamar(tokens.gui, 'POST', '/admin/encerrar')).status).toBe(200);
    ano = await pinsDe2026();
    expect(ano).toMatchObject({ premiacao: 'completa', atual: true });
    expect(ano.pins).toHaveLength(6);
    expect(ano.pins.every((p) => p.vencedores?.length === 1)).toBe(true);

    // Depois de encerrada, dá para pôr o link das fotos sem mexer nos resultados nem nas justificativas.
    const justificativas = d1('SELECT count(*) AS n FROM justificativas WHERE ano = 2026')[0].n;
    const link = 'https://drive.google.com/drive/folders/fotos-2026';
    expect((await chamar(tokens.gui, 'PUT', '/admin/hall/2026', { data: null, local: null, fotosUrl: link })).status).toBe(200);
    expect(d1('SELECT count(*) AS n FROM justificativas WHERE ano = 2026')[0].n).toBe(justificativas);
    expect((await pinsDe2026()).fotosUrl).toBe(link);
    expect((await pinsDe2026()).pins.every((p) => p.vencedores?.length === 1)).toBe(true);
  });

  it('fotos só com URL assinada', async () => {
    const webp = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
    const up = await fetch(`${BASE}/admin/fotos/gui/256`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${tokens.gui}`, 'content-type': 'image/webp' },
      body: webp,
    });
    expect(up.status).toBe(200);
    const { dados: e } = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    const url = e.pessoas.find((p) => p.id === 'gui')!.foto!.p;
    const foto = await fetch(url);
    expect(foto.status).toBe(200);
    expect(foto.headers.get('content-type')).toBe('image/webp');
    expect((await fetch(url.replace(/s=[^&]+/, 's=adulterada'))).status).toBe(403);
  });

  it('só o admin recomeça a edição, e isso apaga tudo do ano', async () => {
    const antes = (await chamar<MeuSorteio>(tokens.ju, 'GET', '/sorteio/meu')).dados.sorteadoEm;
    expect(antes).toBeGreaterThan(0);
    expect((await chamar(tokens.ju, 'POST', '/admin/edicao/recomecar', { ano: 2026 })).status).toBe(403);
    expect((await chamar(tokens.gui, 'POST', '/admin/edicao/recomecar', {})).status).toBe(400);
    expect((await chamar(tokens.gui, 'POST', '/admin/edicao/recomecar', { ano: 2025 })).status).toBe(400);
    expect((await chamar(tokens.gui, 'POST', '/admin/edicao/recomecar', { ano: 2026 })).status).toBe(200);

    const { dados: e } = await chamar<Estado>(tokens.ju, 'GET', '/estado');
    expect(e.edicao.fase).toBe('preparacao');
    expect(e.lobby.presentes).toEqual([]);
    expect(e.revelacao).toEqual({ reveladas: 0, total: 0 });
    expect(e.eu).toMatchObject({ vinculo: null, tirouAlguem: false, votosEnviados: false });
    // A sala de troféus de 2026 volta a ficar só com as sombras.
    const ano2026 = (await chamar<AnoHall[]>(tokens.ju, 'GET', '/hall')).dados.find((a) => a.ano === 2026)!;
    expect(ano2026.premiacao).toBe('em-breve');
    expect(ano2026.pins.every((p) => p.vencedores === null)).toBe(true);
    const tabelas = ['lobby', 'sorteio', 'votos', 'cedulas', 'resultados', 'justificativas', 'edicao_categorias'];
    const contagem = d1(
      `SELECT ${tabelas.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(', ')}, (SELECT count(*) FROM categorias WHERE ativa = 1) AS categorias`,
    )[0];
    expect(contagem).toEqual({ ...Object.fromEntries(tabelas.map((t) => [t, 0])), categorias: 6 });
    // Pessoas, fotos e quem participa continuam.
    expect(e.pessoas.filter((p) => p.naEdicao)).toHaveLength(9);
    expect(e.pessoas.find((p) => p.id === 'gui')?.foto).not.toBeNull();

    // Uma rodada nova funciona do começo, com um sorteio novo.
    expect((await chamar(tokens.gui, 'POST', '/admin/lobby/abrir')).status).toBe(200);
    for (const id of turma) expect((await chamar(tokens[id], 'POST', '/lobby/entrar')).status).toBe(200);
    expect((await chamar(tokens.gui, 'POST', '/admin/sortear')).status).toBe(200);
    const recebedores = new Set<string>();
    for (const id of turma) {
      const r = await chamar<MeuSorteio>(tokens[id], 'GET', '/sorteio/meu');
      expect(r.dados.recebedor.id).not.toBe(id);
      expect(r.dados.sorteadoEm).toBeGreaterThan(antes);
      recebedores.add(r.dados.recebedor.id);
    }
    expect(recebedores.size).toBe(9);
  });
});
