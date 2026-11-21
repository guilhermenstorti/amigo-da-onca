import { signal } from '@preact/signals';

export type Rota = 'inicio' | 'lobby' | 'sorteio' | 'votacao' | 'revelacao' | 'hall' | 'telao';
const ROTAS: Rota[] = ['inicio', 'lobby', 'sorteio', 'votacao', 'revelacao', 'hall', 'telao'];

function lerHash(): Rota {
  const nome = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROTAS as string[]).includes(nome) ? (nome as Rota) : 'inicio';
}

/** Roteamento por hash: o GitHub Pages não tem fallback de SPA. */
export const rota = signal<Rota>(lerHash());

window.addEventListener('hashchange', () => {
  rota.value = lerHash();
  window.scrollTo(0, 0);
});

export function ir(destino: Rota) {
  location.hash = destino === 'inicio' ? '/' : `/${destino}`;
}
