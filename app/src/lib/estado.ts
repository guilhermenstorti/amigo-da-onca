import { computed, effect, signal } from '@preact/signals';
import type { Estado } from '../../../api/src/contrato';
import { api, ErroApi } from './api';
import { token } from './sessao';

/** Tudo o que este aparelho pode ver agora (fase, presença, progresso). Fonte da verdade: o servidor. */
export const estado = signal<Estado | null>(null);
export const semConexao = signal(false);

const LENTO = 15_000;
const RAPIDO = 1_500;

let versao = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let emVoo: Promise<void> | null = null;
let rapidos = 0;

function agendar(ms = rapidos > 0 ? RAPIDO : LENTO) {
  clearTimeout(timer);
  if (document.hidden || !token.value) return;
  timer = setTimeout(() => void atualizar(), ms);
}

/** Busca o estado agora. Responde 204 (barato) quando nada mudou. */
export function atualizar(): Promise<void> {
  if (emVoo) return emVoo;
  emVoo = (async () => {
    const t = token.value;
    if (!t) return;
    try {
      const novo = await api<Estado | null>('GET', `/estado${versao ? `?v=${versao}` : ''}`);
      if (t !== token.value) return; // trocou de sessão no meio
      if (novo) {
        versao = novo.versao;
        estado.value = novo;
      }
      semConexao.value = false;
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'rede') semConexao.value = true;
    }
  })().finally(() => {
    emVoo = null;
    agendar();
  });
  return emVoo;
}

/** Telas ao vivo (lobby, revelação, telão) consultam a cada 1,5 s enquanto estão abertas. */
export function usarModoRapido() {
  rapidos++;
  agendar(0);
  return () => {
    rapidos--;
    agendar();
  };
}

// Trocou o token (palavra-chave, perfil): recomeça do zero.
effect(() => {
  token.value;
  versao = 0;
  clearTimeout(timer);
  void atualizar();
});

document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('oculto', document.hidden);
  if (document.hidden) clearTimeout(timer);
  else void atualizar();
});

export const eu = computed(() => estado.value?.eu ?? null);
export const souAdmin = computed(() => !!estado.value?.eu?.admin);
export const fase = computed(() => estado.value?.edicao.fase ?? null);

export function pessoa(id: string | null | undefined) {
  return estado.value?.pessoas.find((p) => p.id === id) ?? null;
}
