import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

// ---------- Movimento reduzido ----------
const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduzirMovimento = signal(consulta.matches);
consulta.addEventListener?.('change', (e) => (reduzirMovimento.value = e.matches));

// ---------- Toast ----------
export type Tom = 'ouro' | 'sucesso' | 'alerta' | 'neutro';
export const toast = signal<{ id: number; texto: string; tom: Tom } | null>(null);
let timerToast: ReturnType<typeof setTimeout> | undefined;

export function mostrarToast(texto: string, tom: Tom = 'ouro') {
  clearTimeout(timerToast);
  toast.value = { id: Date.now(), texto, tom };
  timerToast = setTimeout(() => (toast.value = null), 2400 + Math.min(texto.length * 25, 2000));
}

// ---------- Tela acesa (lobby) ----------
interface WakeLock {
  release(): Promise<void>;
}

export function useTelaAcesa(ativo: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLock> } };
    if (!ativo || !nav.wakeLock) return;
    let trava: WakeLock | null = null;
    const pedir = async () => {
      try {
        trava = await nav.wakeLock!.request('screen');
      } catch {
        /* sem permissão: segue sem */
      }
    };
    const aoVoltar = () => !document.hidden && void pedir();
    void pedir();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      void trava?.release().catch(() => {});
    };
  }, [ativo]);
}

// ---------- Texto ----------
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-12-20" → "20 dez" */
export function dataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export function listaNomes(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
