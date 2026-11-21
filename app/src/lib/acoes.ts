import { api, mensagemDe } from './api';
import { atualizar } from './estado';
import { mostrarToast } from './ui';

/** Ação do admin feita da própria tela: chama a API e já atualiza o estado de todo mundo. */
export async function acaoAdmin(caminho: string, sucesso?: string, corpo?: unknown) {
  try {
    await api('POST', `/admin/${caminho}`, corpo);
    await atualizar();
    if (sucesso) mostrarToast(sucesso, 'sucesso');
    return true;
  } catch (e) {
    mostrarToast(mensagemDe(e), 'alerta');
    return false;
  }
}

export async function entrarNoLobby() {
  try {
    await api('POST', '/lobby/entrar');
    await atualizar();
  } catch (e) {
    mostrarToast(mensagemDe(e), 'alerta');
  }
}
