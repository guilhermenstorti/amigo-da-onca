import { signal } from '@preact/signals';

/** Folhas globais: abrem por cima de qualquer tela, sem trocar de rota. */
export const controleAberto = signal(false);
export const perfilAberto = signal(false);
