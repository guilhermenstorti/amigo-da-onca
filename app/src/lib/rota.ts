import { signal } from '@preact/signals';

export type Rota = 'inicio' | 'lobby' | 'sorteio' | 'votacao' | 'revelacao' | 'hall' | 'telao';
const ROTAS: Rota[] = ['inicio', 'lobby', 'sorteio', 'votacao', 'revelacao', 'hall', 'telao'];

function lerHash(): Rota {
  const nome = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROTAS as string[]).includes(nome) ? (nome as Rota) : 'inicio';
}

/** "#/lobby?hall": o Hall da Fama aberto por cima da tela, que continua montada embaixo. */
const lerHall = () => /[?&]hall(?:[&=]|$)/.test(location.hash);

/** A tela atual sem o "?hall": "/lobby", "/". */
const caminhoBase = () => location.hash.replace(/^#/, '').split('?')[0] || '/';

/** Roteamento por hash: o GitHub Pages não tem fallback de SPA. */
export const rota = signal<Rota>(lerHash());
export const hallAberto = signal(lerHall());

/** O "?hall" foi empilhado por este app: fechar = voltar no histórico (e o gesto de voltar do iPhone fecha o Hall). */
let hallEmpilhado = false;

window.addEventListener('hashchange', () => {
  const nova = lerHash();
  const mudouDeTela = nova !== rota.value;
  rota.value = nova;
  hallAberto.value = lerHall();
  if (!hallAberto.value) hallEmpilhado = false;
  if (mudouDeTela) window.scrollTo(0, 0);
});

export function ir(destino: Rota) {
  location.hash = destino === 'inicio' ? '/' : `/${destino}`;
}

/** Abre o Hall da Fama por cima da tela atual, sem sair dela (no lobby, a pessoa continua no lobby). */
export function abrirHall() {
  if (hallAberto.value) return;
  hallEmpilhado = true;
  location.hash = `${caminhoBase()}?hall`;
}

export function fecharHall() {
  if (!hallAberto.value) return;
  if (hallEmpilhado) {
    history.back();
    return;
  }
  descartarHall();
}

/** Fecha o Hall sem mexer no histórico (ex.: o sorteio começou e a tela vai sozinha para a roleta). */
export function descartarHall() {
  if (!hallAberto.value) return;
  history.replaceState(history.state, '', `#${caminhoBase()}`);
  hallAberto.value = false;
  hallEmpilhado = false;
}
