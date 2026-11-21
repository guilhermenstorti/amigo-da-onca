// Simula os outros participantes contra a API local (para ensaiar a noite sem 9 celulares).
// Uso: node scripts/simular.mjs lobby [ms entre chegadas]   → todo mundo (menos o admin) entra no lobby
//      node scripts/simular.mjs votar                        → todo mundo (menos o admin) vota e envia
// Variáveis: API (padrão http://localhost:8787), PALAVRA (padrão a do .dev.vars.example).
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const API = process.env.API ?? 'http://localhost:8787';
const PALAVRA = process.env.PALAVRA ?? 'onca';
const [, , comando, arg] = process.argv;
const cache = new URL('../.tmp/simulacao.json', import.meta.url);

async function chamar(token, metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → ${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

/** Um "celular" por participante, guardado entre execuções (o perfil fica preso ao aparelho). */
async function aparelhos() {
  let salvos = {};
  try {
    salvos = JSON.parse(await readFile(cache, 'utf8'));
  } catch {}
  const { token: t0 } = await chamar(null, 'POST', '/acesso', { palavra: PALAVRA });
  const estado = await chamar(t0, 'GET', '/estado');
  const outros = estado.pessoas.filter((p) => p.naEdicao && !p.admin);
  for (const p of outros) {
    if (salvos[p.id]) continue;
    const { token: ta } = await chamar(null, 'POST', '/acesso', { palavra: PALAVRA });
    salvos[p.id] = (await chamar(ta, 'POST', '/sessao', { participante: p.id })).token;
  }
  await mkdir(new URL('.', cache), { recursive: true });
  await writeFile(cache, JSON.stringify(salvos));
  return { outros, tokens: salvos, estado };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

if (comando === 'lobby') {
  const { outros, tokens } = await aparelhos();
  for (const p of outros) {
    await chamar(tokens[p.id], 'POST', '/lobby/entrar');
    console.log(`${p.nome} entrou no lobby`);
    await esperar(Number(arg ?? 2500));
  }
} else if (comando === 'votar') {
  const { outros, tokens, estado } = await aparelhos();
  const candidatos = estado.pessoas.filter((p) => p.naEdicao).map((p) => p.id);
  const frases = ['ninguém entendeu nada', 'usei no mesmo dia', 'o papel era melhor que o presente', 'chorei de rir', ''];
  for (const p of outros) {
    for (const c of estado.votacao.categorias) {
      const indicado = candidatos[Math.floor(Math.random() * candidatos.length)];
      await chamar(tokens[p.id], 'PUT', `/votos/${c.id}`, { indicado, justificativa: frases[Math.floor(Math.random() * frases.length)] });
    }
    await chamar(tokens[p.id], 'POST', '/votos/enviar');
    console.log(`${p.nome} votou`);
  }
} else {
  console.log('Uso: node scripts/simular.mjs lobby|votar');
}
