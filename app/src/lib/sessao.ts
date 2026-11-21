import { computed, signal } from '@preact/signals';
import { gravar, ler } from './local';

const CHAVE_APARELHO = 'onca:aparelho';
const CHAVE_SESSAO = 'onca:sessao';

/** Token depois da palavra-chave (identifica o aparelho). */
export const tokenAparelho = signal<string | null>(ler(CHAVE_APARELHO));
/** Token depois de escolher o perfil. */
export const tokenSessao = signal<string | null>(ler(CHAVE_SESSAO));

export const token = computed(() => tokenSessao.value ?? tokenAparelho.value);

export function definirAparelho(t: string) {
  tokenAparelho.value = t;
  tokenSessao.value = null;
  gravar(CHAVE_APARELHO, t);
  gravar(CHAVE_SESSAO, null);
}

export function definirSessao(t: string) {
  tokenSessao.value = t;
  gravar(CHAVE_SESSAO, t);
}

export function sairDoPerfil() {
  tokenSessao.value = null;
  gravar(CHAVE_SESSAO, null);
}

/** A palavra-chave mudou ou o token venceu: volta para a tela da palavra-chave. */
export function esquecerTudo() {
  tokenAparelho.value = null;
  tokenSessao.value = null;
  gravar(CHAVE_APARELHO, null);
  gravar(CHAVE_SESSAO, null);
}
